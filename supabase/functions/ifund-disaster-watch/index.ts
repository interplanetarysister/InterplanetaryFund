// ifund-disaster-watch: poll free public disaster feeds (NWS, USGS, GDACS)
// every 10 minutes via pg_cron, store authoritative alerts, match them to
// active help/need campaigns in the affected area, and send each matched
// campaign owner one in-app disaster check-in (type 'disaster_checkin').
//
// Shape copied from supabase/functions/ifund-weekly-agent-training/index.ts:
// Deno, POST-only, 64-char token check via RPC, Supabase reached over REST
// with SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.
//
// Authorization: the pg_cron caller presents a token in the
// `x-ifund-disaster-token` header; `ifund_disaster_authorize(p_token)`
// compares its SHA-256 against the vault secret `ifund_disaster_cron_token`
// (defined by the DB slice migration
// supabase/migrations/20261126190000_ifund_disaster_response.sql).
// No live financial transaction, no external publishing, no email —
// Phase 1 is in-app check-ins only.
//
// Live-feed notes (verified 2026-11-27):
// - NWS: https://api.weather.gov/alerts/active?status=actual&message_type=alert
//   requires a User-Agent header. The `limit` query param is NOT recognized
//   by the live API (HTTP 400), so it is omitted. Geometry is a GeoJSON
//   Polygon/MultiPolygon or null; geometry-less alerts resolve it from
//   their affectedZones URLs (fetchNwsZoneGeometry below — zone endpoints
//   return a GeometryCollection of Polygon/MultiPolygon members), and only
//   zone-less alerts stay stored-but-unmatched.
// - USGS: magnitude >= 5.0; radius heuristic round(25 * 2^(mag-5)), cap 500 km.
// - GDACS: event list is a GeoJSON FeatureCollection; the `eventtype` query
//   param is IGNORED, so filtering is client-side. url.geometry returns a
//   FeatureCollection whose first feature is the centroid Point and later
//   features carry the affected-area Polygon(s); when no polygon is
//   fetchable, matching falls back to a documented approximate 100 km
//   radius around the centroid (GDACS_FALLBACK_RADIUS_KM).

import {
  normalizeNwsFeature,
  normalizeUsgsFeature,
  normalizeGdacsFeature,
  gdacsPolygonFromCollection,
  nwsZonePolygonFromFeature,
  NWS_ZONE_FETCH_LIMIT,
  centroidOfGeometry,
  alertMatchesCampaign,
  buildDedupeKey,
  buildCheckinMessage,
  isWithinDedupeWindow,
  MATCH_CATEGORIES,
  type NormalizedAlert,
  type CampaignLocation,
} from "./disasterLib.ts";

const url = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const NWS_URL = "https://api.weather.gov/alerts/active?status=actual&message_type=alert";
const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";
const USER_AGENT = "InterplanetaryFund/1.0 (disaster-watch; contact support@interplanetaryfund.com)";

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function rpc(name: string, body: Record<string, unknown> = {}) {
  const r = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: key, authorization: "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw Error("database RPC " + name + " failed: " + r.status + " " + txt.slice(0, 160));
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    throw Error("Invalid database reply");
  }
}

async function rest(path: string, options: RequestInit = {}) {
  const r = await fetch(url + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: key,
      authorization: "Bearer " + key,
      "content-type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  const txt = await r.text();
  if (!r.ok) throw Error("database REST " + path + " failed: " + r.status + " " + txt.slice(0, 160));
  try {
    return txt ? JSON.parse(txt) : null;
  } catch {
    throw Error("Invalid database reply");
  }
}

async function fetchJson(feedUrl: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(feedUrl, { signal: controller.signal, headers: { "user-agent": USER_AGENT, accept: "application/json" } });
    if (!r.ok) throw Error(feedUrl + " returned HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGdacsPolygon(alert: NormalizedAlert): Promise<void> {
  if (!alert.polygon_url) return;
  try {
    const collection = await fetchJson(alert.polygon_url, 8000);
    const polygon = gdacsPolygonFromCollection(collection);
    if (polygon) {
      alert.geometry = polygon;
      alert.centroid = centroidOfGeometry(polygon);
      alert.radius_km = null;
    }
    // No polygon feature (or fetch failure): keep the centroid + the
    // documented approximate 100 km fallback radius from normalization.
  } catch (err) {
    console.error("gdacs polygon fetch failed for " + alert.source_event_id, String(err).slice(0, 200));
  }
}

// NWS zone fallback (spec section 2: county/ZIP geometry when an alert
// has no polygon): a geometry-less NWS alert carries affectedZones URLs
// (verified live 2026-11-27: 4 of 8 qualifying warnings had no geometry,
// each with 1-3 zone URLs; zone endpoints return a Feature whose geometry
// is a GeometryCollection of Polygon/MultiPolygon members). Fetch the
// first few zones until one yields a polygon, and use it as the alert
// geometry — zone scale is county/forecast-zone, coarser than an alert
// polygon but the area-level match the spec promises. Best effort, like
// the GDACS polygon fetch: a failure or a zone-less alert keeps the old
// stored-but-unmatched behaviour. Only api.weather.gov zone URLs are
// fetched.
async function fetchNwsZoneGeometry(alert: NormalizedAlert): Promise<void> {
  if (alert.source !== "nws" || alert.geometry || !alert.zone_urls) return;
  for (const zoneUrl of alert.zone_urls.slice(0, NWS_ZONE_FETCH_LIMIT)) {
    if (!zoneUrl.startsWith("https://api.weather.gov/zones/")) continue;
    try {
      const feature = await fetchJson(zoneUrl, 8000);
      const polygon = nwsZonePolygonFromFeature(feature);
      if (polygon) {
        alert.geometry = polygon;
        alert.centroid = centroidOfGeometry(polygon);
        alert.radius_km = null;
        return;
      }
    } catch (err) {
      console.error("nws zone fetch failed for " + alert.source_event_id, String(err).slice(0, 200));
    }
  }
}

async function fetchFeedAlerts(): Promise<{ alerts: NormalizedAlert[]; errors: string[] }> {
  const alerts: NormalizedAlert[] = [];
  const errors: string[] = [];
  const feeds: { name: string; url: string; normalize: (f: unknown) => NormalizedAlert | null }[] = [
    { name: "nws", url: NWS_URL, normalize: normalizeNwsFeature },
    { name: "usgs", url: USGS_URL, normalize: normalizeUsgsFeature },
    { name: "gdacs", url: GDACS_URL, normalize: normalizeGdacsFeature },
  ];
  const results = await Promise.all(feeds.map(async (feed) => {
    try {
      const body = await fetchJson(feed.url, 15000);
      const features = Array.isArray(body?.features) ? body.features : [];
      return features.map(feed.normalize).filter((a): a is NormalizedAlert => a !== null);
    } catch (err) {
      errors.push(feed.name + ": " + String(err).slice(0, 200));
      return [];
    }
  }));
  for (const list of results) alerts.push(...list);
  // Resolve GDACS polygons (best effort; centroid fallback stays otherwise).
  await Promise.all(alerts.filter((a) => a.source === "gdacs").map(fetchGdacsPolygon));
  // Resolve NWS zone geometry for geometry-less alerts (best effort;
  // alerts that stay geometry-less are stored but unmatched).
  await Promise.all(alerts.filter((a) => a.source === "nws").map(fetchNwsZoneGeometry));
  return { alerts, errors };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  if (!url || !key) return response({ error: "Server not configured" }, 503);
  const token = req.headers.get("x-ifund-disaster-token");
  if (!token || token.length !== 64) return response({ error: "Unauthorized" }, 401);
  try {
    const ok = await rpc("ifund_disaster_authorize", { p_token: token });
    if (ok !== true) return response({ error: "Unauthorized" }, 401);

    const { alerts, errors } = await fetchFeedAlerts();

    // Upsert alerts (unique on source + source_event_id). Returns the rows
    // with their ids for the check-in foreign keys.
    let stored: { id: string; source: string; source_event_id: string }[] = [];
    if (alerts.length) {
      const rows = alerts.map((a) => ({
        source: a.source,
        source_event_id: a.source_event_id,
        disaster_type: a.disaster_type,
        severity: a.severity,
        title: a.title.slice(0, 500),
        area_description: a.area_description.slice(0, 500),
        geometry: a.geometry,
        started_at: a.started_at,
        expires_at: a.expires_at,
      }));
      stored = await rest("ifund_disaster_alerts?on_conflict=source,source_event_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(rows),
      });
    }
    const storedByKey = new Map(stored.map((s) => [`${s.source}|${s.source_event_id}`, s.id]));
    const alertsByKey = new Map(alerts.map((a) => [`${a.source}|${a.source_event_id}`, a]));

    // Cohort: active help/need campaigns with an opted-in map location.
    const campaigns: CampaignLocation[] = await rest(
      "ifund_campaigns?select=id,owner_id,title,cover_image_url,map_latitude,map_longitude" +
        "&status=eq.active" +
        "&category=in.(" + MATCH_CATEGORIES.join(",") + ")" +
        "&map_opt_in=is.true&map_latitude=not.is.null&map_longitude=not.is.null",
      { method: "GET" },
    );

    const nowMs = Date.now();
    const windowStart = new Date(nowMs - 72 * 60 * 60 * 1000).toISOString();
    let matched = 0;
    let checkinsCreated = 0;
    let dedupeSkipped = 0;
    let checkinErrors: string[] = [];
    for (const alert of alerts) {
      const alertId = storedByKey.get(`${alert.source}|${alert.source_event_id}`);
      if (!alertId) continue;
      for (const campaign of campaigns) {
        if (!alertMatchesCampaign(alert, campaign)) continue;
        matched++;
        const dedupeKey = buildDedupeKey(campaign.id, alert.disaster_type, alert.centroid);
        if (!dedupeKey) continue;
        // Cross-source dedupe: skip when a check-in with the same
        // campaign|type|area key exists within 72h. The unique
        // (alert_id, campaign_id) constraint is the second guard.
        const existing: { asked_at: string }[] = await rest(
          "ifund_disaster_checkins?select=asked_at" +
            "&dedupe_key=eq." + encodeURIComponent(dedupeKey) +
            "&asked_at=gte." + encodeURIComponent(windowStart),
          { method: "GET" },
        );
        if (existing.some((row) => isWithinDedupeWindow(row.asked_at, nowMs))) {
          dedupeSkipped++;
          continue;
        }
        const message = buildCheckinMessage(alert);
        // One ask per disaster per campaign, forever: the 72h dedupe above
        // only covers recent asks, but unique(alert_id, campaign_id) makes
        // a re-ask for the SAME alert fail — so skip here when a check-in
        // already exists for this alert + campaign, whatever its age.
        // Without this, an alert that stays active past 72h (a multi-day
        // flood warning) would re-match, insert a duplicate notification,
        // then throw on the unique constraint and 500 the whole poll —
        // every 10 minutes, until the alert expires.
        const alreadyAsked: { id: string }[] = await rest(
          "ifund_disaster_checkins?select=id" +
            "&alert_id=eq." + encodeURIComponent(alertId) +
            "&campaign_id=eq." + encodeURIComponent(campaign.id),
          { method: "GET" },
        );
        if (alreadyAsked.length) {
          dedupeSkipped++;
          continue;
        }
        let notificationId: string | null = null;
        try {
          const notification: { id: string }[] = await rest("ifund_notifications", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify([{
              owner_id: campaign.owner_id,
              title: message.title.slice(0, 200),
              body: message.body.slice(0, 4000),
              type: "disaster_checkin",
              link: "/notifications",
              // Every other server-side ifund_notifications writer supplies
              // canonical_operation_id, and the column has no DDL anywhere
              // in the repo — so its nullability on the live table is
              // unproven from source. Do not bet the poll on NULL being
              // accepted: reuse the dedupe key as this ask's operation
              // identity (well inside the 256-char bound the other writers
              // observe).
              canonical_operation_id: "disaster-checkin:v1:" + dedupeKey,
            }]),
          });
          notificationId = notification[0]?.id ?? null;
          await rest("ifund_disaster_checkins", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify([{
              alert_id: alertId,
              campaign_id: campaign.id,
              owner_id: campaign.owner_id,
              notification_id: notificationId,
              status: "pending",
              dedupe_key: dedupeKey,
            }]),
          });
        } catch (err) {
          // One bad row must not abort the whole poll or orphan a
          // notification with no Yes/No card: remove the notification this
          // attempt just created (best effort) and carry on to the next
          // campaign; the failure is reported in checkin_errors.
          if (notificationId) {
            try {
              await rest("ifund_notifications?id=eq." + encodeURIComponent(notificationId), { method: "DELETE" });
            } catch {
              // Best-effort cleanup; the error is already recorded below.
            }
          }
          checkinErrors.push(campaign.id + ": " + String(err).slice(0, 200));
          continue;
        }
        checkinsCreated++;
      }
    }

    return response({
      ok: true,
      alerts_fetched: alerts.length,
      alerts_stored: stored.length,
      campaigns_considered: campaigns.length,
      matched,
      checkins_created: checkinsCreated,
      dedupe_skipped: dedupeSkipped,
      checkin_errors: checkinErrors,
      feed_errors: errors,
    });
  } catch (err) {
    console.error("ifund disaster watch request failed", String(err).slice(0, 200));
    return response({ error: "Internal workflow failure" }, 500);
  }
});
