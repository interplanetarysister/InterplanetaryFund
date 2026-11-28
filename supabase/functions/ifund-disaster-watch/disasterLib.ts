// Disaster-response watch: pure normalization / geometry / matching / dedupe /
// message / draft builders for the ifund-disaster-watch edge function.
//
// Erasable TypeScript with NO imports, so root `node:test` can import this
// file directly (Node v24 type-stripping) and Deno can import it too.
// No network, no environment access, no side effects in this module.

export type DisasterType =
  | "tornado"
  | "flood"
  | "hurricane"
  | "wildfire"
  | "winter_storm"
  | "earthquake"
  | "volcano";

export type AlertSource = "nws" | "usgs" | "gdacs";

export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type NormalizedAlert = {
  source: AlertSource;
  source_event_id: string;
  disaster_type: DisasterType;
  severity: string;
  title: string;
  area_description: string;
  // Raw GeoJSON geometry (Polygon / MultiPolygon / Point) or null.
  // NWS alerts without geometry resolve it from their affectedZones
  // (fetchNwsZoneGeometry in index.ts, county/forecast-zone scale);
  // alerts that stay geometry-less are stored but NOT matched — there is
  // no area to test a campaign location against.
  geometry: GeoJsonGeometry | null;
  // NWS affectedZones URLs (api.weather.gov/zones/...) for the zone
  // fallback; null for other sources and for alerts with no zones.
  zone_urls: string[] | null;
  started_at: string | null;
  expires_at: string | null;
  // [longitude, latitude] centroid used for area_bucket dedupe and radius
  // matching, or null when no geometry / coordinates are available.
  centroid: [number, number] | null;
  // Radius in km for point-based matching (USGS magnitude heuristic, GDACS
  // centroid fallback). Null for polygon-matched alerts.
  radius_km: number | null;
  // GDACS polygon endpoint (url.geometry), when the feed supplied one.
  polygon_url: string | null;
  // USGS magnitude, when known.
  magnitude: number | null;
  // Raw NWS event name (e.g. "Flash Flood Warning"), when known.
  event: string | null;
};

export type CampaignLocation = {
  id: string;
  owner_id: string;
  title: string;
  cover_image_url: string | null;
  map_latitude: number;
  map_longitude: number;
};

// Campaign cohort: active help/need campaigns only. Category values verified
// against apps/web/src/lib/goalSuccessAnalysis.mjs:39 and the campaigns
// table (category text, status 'active' is the public state).
export const MATCH_CATEGORIES: string[] = ["emergency", "medical", "disaster_relief"];

// NWS zone fallback (spec section 2: county/ZIP geometry when an alert
// has no polygon): how many affectedZones URLs the normalizer keeps per
// alert, and how many the edge function fetches before giving up.
export const NWS_MAX_ZONE_URLS: number = 5;
export const NWS_ZONE_FETCH_LIMIT: number = 3;

// USGS: only magnitude >= 5.0 triggers anything.
export const USGS_MIN_MAGNITUDE: number = 5.0;
// USGS radius heuristic (documented as approximate):
// radius_km = round(25 * 2^(mag - 5)), capped at 500 km.
export const USGS_RADIUS_CAP_KM: number = 500;
export function usgsRadiusKm(magnitude: number): number {
  const radius = Math.round(25 * Math.pow(2, magnitude - 5));
  return Math.min(radius, USGS_RADIUS_CAP_KM);
}

// GDACS centroid fallback radius (documented as approximate): the GDACS
// event list carries only a centroid point, and the polygon endpoint is not
// always fetchable. Verified live 2026-11-27: url.geometry returns a
// FeatureCollection whose first feature is the centroid Point and later
// features carry the affected-area Polygon(s); when no Polygon feature is
// present (or the fetch fails), matching falls back to this 100 km radius
// around the centroid. Area-level matching only — never street-level.
export const GDACS_FALLBACK_RADIUS_KM: number = 100;

// Cross-source dedupe window: one check-in per campaign per disaster per
// overlapping area within 72 hours.
export const DEDUPE_WINDOW_MS: number = 72 * 60 * 60 * 1000;

export const GDACS_ALLOWED_TYPES: string[] = ["EQ", "FL", "TC", "WF", "VO"];

const GDACS_TYPE_MAP: Record<string, DisasterType> = {
  EQ: "earthquake",
  FL: "flood",
  TC: "hurricane",
  WF: "wildfire",
  VO: "volcano",
};

const NWS_SEVERITIES: string[] = ["extreme", "severe"];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function iso(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// --- NWS -----------------------------------------------------------------

export function nwsEventToType(event: string): DisasterType | null {
  const e = event.toLowerCase();
  if (e.includes("tornado")) return "tornado";
  if (e.includes("flash flood") || e.includes("flood")) return "flood";
  if (e.includes("hurricane") || e.includes("tropical storm")) return "hurricane";
  if (e.includes("wildfire") || e.includes("fire weather") || e.includes("red flag")) return "wildfire";
  if (e.includes("winter") || e.includes("blizzard") || e.includes("ice storm")) return "winter_storm";
  return null;
}

// NWS filter (verified live 2026-11-27 against api.weather.gov): the feed
// returns a GeoJSON FeatureCollection; properties carry status "Actual",
// messageType "Alert"/"Update", event, severity, areaDesc, and geometry is a
// GeoJSON Polygon/MultiPolygon or null. Only warnings at Extreme/Severe
// severity qualify. NOTE: the spec's `limit=500` query param is NOT
// recognized by the live API (HTTP 400 "Query parameter limit is not
// recognized") — the edge function omits it.
export function normalizeNwsFeature(feature: unknown): NormalizedAlert | null {
  if (!isRecord(feature)) return null;
  const props = isRecord(feature.properties) ? feature.properties : {};
  if (text(props.status).toLowerCase() !== "actual") return null;
  const messageType = text(props.messageType);
  if (messageType !== "Alert" && messageType !== "Update") return null;
  const event = text(props.event);
  if (!event.endsWith("Warning")) return null;
  const severity = text(props.severity).toLowerCase();
  if (!NWS_SEVERITIES.includes(severity)) return null;
  const disasterType = nwsEventToType(event);
  if (!disasterType) return null;
  const sourceEventId = text(props.id);
  if (!sourceEventId) return null;
  const geometry = parseGeometry(feature.geometry);
  return {
    source: "nws",
    source_event_id: sourceEventId,
    disaster_type: disasterType,
    severity,
    title: text(props.headline) || event,
    area_description: text(props.areaDesc),
    geometry,
    zone_urls: parseNwsZoneUrls(props.affectedZones),
    started_at: iso(props.sent) || iso(props.effective),
    expires_at: iso(props.expires) || iso(props.ends),
    centroid: centroidOfGeometry(geometry),
    radius_km: null,
    polygon_url: null,
    magnitude: null,
    event,
  };
}

// NWS affectedZones: keep the first few non-empty URL strings for the
// zone fallback. The api.weather.gov/zones/ prefix is enforced at the
// fetch site (index.ts), not here, so this stays a pure normalizer.
function parseNwsZoneUrls(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const urls = value
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, NWS_MAX_ZONE_URLS);
  return urls.length ? urls : null;
}

// Extract the first Polygon/MultiPolygon geometry from an NWS zone
// Feature. Verified live 2026-11-27: zone endpoints
// (api.weather.gov/zones/{county,forecast}/...) return a Feature whose
// geometry is a GeometryCollection holding Polygon/MultiPolygon members
// (e.g. MDZ024: MultiPolygon then Polygon); a bare Polygon/MultiPolygon
// geometry is accepted too. Anything else yields null.
export function nwsZonePolygonFromFeature(feature: unknown): GeoJsonGeometry | null {
  if (!isRecord(feature)) return null;
  const geometry = feature.geometry;
  if (!isRecord(geometry)) return null;
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return parseGeometry(geometry);
  }
  if (geometry.type === "GeometryCollection" && Array.isArray(geometry.geometries)) {
    for (const member of geometry.geometries) {
      const polygon = parseGeometry(member);
      if (polygon && (polygon.type === "Polygon" || polygon.type === "MultiPolygon")) return polygon;
    }
  }
  return null;
}

function parseGeometry(value: unknown): GeoJsonGeometry | null {
  if (!isRecord(value)) return null;
  if (typeof value.type !== "string" || value.coordinates === undefined) return null;
  return { type: value.type, coordinates: value.coordinates };
}

// --- USGS ------------------------------------------------------------------

export function normalizeUsgsFeature(feature: unknown): NormalizedAlert | null {
  if (!isRecord(feature)) return null;
  const props = isRecord(feature.properties) ? feature.properties : {};
  const mag = num(props.mag);
  if (mag === null || mag < USGS_MIN_MAGNITUDE) return null;
  const id = text(feature.id);
  if (!id) return null;
  const geometry = parseGeometry(feature.geometry);
  if (!geometry || geometry.type !== "Point") return null;
  const coords = geometry.coordinates;
  if (!Array.isArray(coords) || num(coords[0]) === null || num(coords[1]) === null) return null;
  const centroid: [number, number] = [coords[0] as number, coords[1] as number];
  const time = num(props.time);
  return {
    source: "usgs",
    source_event_id: id,
    disaster_type: "earthquake",
    severity: mag >= 7 ? "extreme" : "severe",
    title: text(props.title) || `M ${mag} earthquake`,
    area_description: text(props.place),
    geometry,
    zone_urls: null,
    started_at: time === null ? null : new Date(time).toISOString(),
    expires_at: null,
    centroid,
    radius_km: usgsRadiusKm(mag),
    polygon_url: null,
    magnitude: mag,
    event: null,
  };
}

// --- GDACS -----------------------------------------------------------------

export function normalizeGdacsFeature(feature: unknown): NormalizedAlert | null {
  if (!isRecord(feature)) return null;
  const props = isRecord(feature.properties) ? feature.properties : {};
  // The `eventtype` query param is IGNORED by the live API, so all filtering
  // happens client-side here. Drought (DR) is excluded: slow-onset,
  // multi-year, continent-scale centroids.
  const eventType = text(props.eventtype);
  if (!GDACS_ALLOWED_TYPES.includes(eventType)) return null;
  // The live API serializes this boolean as the quoted string "'true'" /
  // "'false'" (verified 2026-11-27: events4app returns "'true'" for all 100
  // current events; SEARCH returns "'false'" for every ended event). The
  // unquoted "true" form and a JSON boolean are accepted too, so a
  // serialization change on GDACS's side cannot silently disable this
  // source. Without the quote-strip, every genuinely current GDACS event
  // was rejected — the source could never produce an alert, while the poll
  // still returned 200 with no feed error.
  const isCurrentRaw = props.iscurrent;
  const isCurrent =
    isCurrentRaw === true ? "true" : text(isCurrentRaw).replace(/^'+|'+$/g, "");
  if (isCurrent !== "true") return null;
  const alertLevel = text(props.alertlevel);
  if (alertLevel !== "Orange" && alertLevel !== "Red") return null;
  const eventId = props.eventid;
  const episodeId = props.episodeid;
  if (typeof eventId !== "number" && typeof eventId !== "string") return null;
  if (typeof episodeId !== "number" && typeof episodeId !== "string") return null;
  const geometry = parseGeometry(feature.geometry);
  let centroid: [number, number] | null = null;
  if (geometry && geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const lng = num(geometry.coordinates[0]);
    const lat = num(geometry.coordinates[1]);
    if (lng !== null && lat !== null) centroid = [lng, lat];
  }
  if (!centroid) return null;
  const url = isRecord(props.url) ? props.url : {};
  const polygonUrl = text(url.geometry) || null;
  return {
    source: "gdacs",
    source_event_id: `${eventType}-${eventId}-${episodeId}`,
    disaster_type: GDACS_TYPE_MAP[eventType],
    severity: alertLevel.toLowerCase(),
    title: text(props.name) || text(props.description) || `${eventType} event ${eventId}`,
    area_description: text(props.country),
    geometry,
    zone_urls: null,
    started_at: iso(props.fromdate),
    expires_at: iso(props.todate),
    centroid,
    // Centroid fallback radius; replaced by polygon matching when the
    // url.geometry endpoint yields a Polygon/MultiPolygon (edge function).
    radius_km: GDACS_FALLBACK_RADIUS_KM,
    polygon_url: polygonUrl,
    magnitude: null,
    event: null,
  };
}

// Extract the first Polygon/MultiPolygon geometry from a GDACS
// url.geometry FeatureCollection response. The first feature is the centroid
// Point; the affected-area polygon(s) come in later features.
export function gdacsPolygonFromCollection(collection: unknown): GeoJsonGeometry | null {
  if (!isRecord(collection)) return null;
  const features = collection.features;
  if (!Array.isArray(features)) return null;
  for (const feature of features) {
    if (!isRecord(feature)) continue;
    const geometry = parseGeometry(feature.geometry);
    if (geometry && (geometry.type === "Polygon" || geometry.type === "MultiPolygon")) {
      return geometry;
    }
  }
  return null;
}

// --- Geometry ---------------------------------------------------------------

type Ring = [number, number][];

function toRing(value: unknown): Ring | null {
  if (!Array.isArray(value)) return null;
  const ring: Ring = [];
  for (const point of value) {
    if (!Array.isArray(point)) return null;
    const lng = num(point[0]);
    const lat = num(point[1]);
    if (lng === null || lat === null) return null;
    ring.push([lng, lat]);
  }
  return ring.length >= 3 ? ring : null;
}

function pointOnSegment(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number,
): boolean {
  const epsilon = 1e-9;
  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  if (Math.abs(cross) > epsilon) return false;
  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= epsilon;
}

// Ray-casting point-in-ring. The ring is treated as closed whether or not
// its last vertex repeats the first (wrapping index handles both), and a
// point exactly on an edge counts as inside.
export function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    if (pointOnSegment(lng, lat, x1, y1, x2, y2)) return true;
  }
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat) {
      const xIntersect = xi + ((lat - yi) * (xj - xi)) / (yj - yi);
      if (lng < xIntersect) inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygonGeometry(
  lng: number, lat: number, geometry: GeoJsonGeometry | null,
): boolean {
  if (!geometry || !Array.isArray(geometry.coordinates)) return false;
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates;
    const exterior = toRing(rings[0]);
    if (!exterior) return false;
    if (!pointInRing(lng, lat, exterior)) return false;
    for (let h = 1; h < rings.length; h++) {
      const hole = toRing(rings[h]);
      if (hole && pointInRing(lng, lat, hole)) return false;
    }
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      if (!Array.isArray(polygon)) continue;
      const exterior = toRing(polygon[0]);
      if (!exterior) continue;
      if (!pointInRing(lng, lat, exterior)) continue;
      let inHole = false;
      for (let h = 1; h < polygon.length; h++) {
        const hole = toRing(polygon[h]);
        if (hole && pointInRing(lng, lat, hole)) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
    return false;
  }
  return false;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthKm * Math.asin(Math.sqrt(a));
}

export function withinRadiusKm(
  lat: number, lng: number,
  centerLat: number, centerLng: number, radiusKm: number,
): boolean {
  return haversineKm(lat, lng, centerLat, centerLng) <= radiusKm;
}

export function centroidOfGeometry(geometry: GeoJsonGeometry | null): [number, number] | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type === "Point") {
    const lng = num(geometry.coordinates[0]);
    const lat = num(geometry.coordinates[1]);
    return lng === null || lat === null ? null : [lng, lat];
  }
  let ring: Ring | null = null;
  if (geometry.type === "Polygon") ring = toRing(geometry.coordinates[0]);
  if (geometry.type === "MultiPolygon") {
    const first = Array.isArray(geometry.coordinates[0]) ? geometry.coordinates[0] : null;
    if (first) ring = toRing(first[0]);
  }
  if (!ring) return null;
  // Average the exterior-ring vertices, dropping a duplicated closing vertex.
  const vertices = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of vertices) { sumLng += lng; sumLat += lat; }
  return [sumLng / vertices.length, sumLat / vertices.length];
}

// --- Matching ---------------------------------------------------------------

// Area-level matching only: campaign coordinates are rounded to a 0.1° grid
// (city-level, never street-level). Polygon alerts match by point-in-polygon;
// point alerts match by distance within radius_km. Alerts without geometry
// (or without a usable centroid/radius) never match.
export function alertMatchesCampaign(alert: NormalizedAlert, campaign: CampaignLocation): boolean {
  const lat = campaign.map_latitude;
  const lng = campaign.map_longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (alert.geometry && (alert.geometry.type === "Polygon" || alert.geometry.type === "MultiPolygon")) {
    return pointInPolygonGeometry(lng, lat, alert.geometry);
  }
  if (alert.centroid && alert.radius_km !== null) {
    return withinRadiusKm(lat, lng, alert.centroid[1], alert.centroid[0], alert.radius_km);
  }
  return false;
}

// --- Dedupe -----------------------------------------------------------------

// area_bucket = alert centroid rounded to 1° (latitude|longitude).
export function areaBucket(centroid: [number, number] | null): string | null {
  if (!centroid) return null;
  return `${Math.round(centroid[1])}|${Math.round(centroid[0])}`;
}

export function buildDedupeKey(
  campaignId: string, disasterType: DisasterType, centroid: [number, number] | null,
): string | null {
  const bucket = areaBucket(centroid);
  if (!bucket) return null;
  return `${campaignId}|${disasterType}|${bucket}`;
}

// True when an existing check-in with the same dedupe key was asked within
// the 72h window (askedAt / now are epoch ms or ISO strings).
export function isWithinDedupeWindow(askedAt: string | number, nowMs: number): boolean {
  const askedMs = typeof askedAt === "number" ? askedAt : new Date(askedAt).getTime();
  if (!Number.isFinite(askedMs)) return false;
  return nowMs - askedMs < DEDUPE_WINDOW_MS && nowMs - askedMs >= 0;
}

// --- Messages + promotion drafts --------------------------------------------

const TYPE_LABELS: Record<DisasterType, string> = {
  tornado: "tornado warning",
  flood: "flood warning",
  hurricane: "hurricane warning",
  wildfire: "wildfire warning",
  winter_storm: "winter storm warning",
  earthquake: "earthquake",
  volcano: "volcanic eruption",
};

export function buildCheckinMessage(alert: NormalizedAlert): { title: string; body: string } {
  const area = alert.area_description || "your area";
  let body: string;
  if (alert.disaster_type === "earthquake") {
    body = `An earthquake has been reported near ${area}. Are you in need of emergency assistance because of this?`;
  } else if (alert.disaster_type === "volcano") {
    body = `A volcanic eruption has been reported near ${area}. Are you in need of emergency assistance because of this?`;
  } else {
    // Prefer the feed's own event wording for NWS warnings ("Flash Flood
    // Warning" -> "flash flood warning"); otherwise the type label.
    const label = alert.event ? alert.event.toLowerCase() : TYPE_LABELS[alert.disaster_type];
    body = `A ${label} is active for ${area}. Are you in need of emergency assistance because of this?`;
  }
  return { title: `Disaster check-in: ${alert.title}`, body };
}

export function buildPromotionDraftFindingId(checkinId: string): string {
  // Agreed shape: 'disaster_promotion_' + substr(checkin_id, 1, 8)
  // (SQL substr is 1-based; JS slice(0, 8) is the same 8 characters).
  return `disaster_promotion_${checkinId.slice(0, 8)}`;
}

export type PromotionDraft = {
  owner_id: string;
  campaign_id: string;
  finding_id: string;
  lead_agent: string;
  review_agents: string[];
  task_title: string;
  suggested_action: string;
  discussion: { agent: string; kind: string; text: string }[];
};

// Promotion draft shaped for ifund_editorial_agent_reviews. This builder
// MUST mirror the insert in ifund_disaster_checkin_answer
// (supabase/migrations/20261126190000_ifund_disaster_response.sql) exactly:
// the RPC is the live path that queues the draft after the owner answers
// "yes", and this builder is the single source of truth for that row's
// shape (the root tests pin it). The row is a drafting task for the
// editorial agents — it instructs them to draft the post from the campaign
// (link + image) at review time; it does not pre-build the post text, and
// it never publishes anything. `alert` is accepted for call-site symmetry
// with the check-in flow; the row itself names the alert only generically.
export function buildPromotionDraft(
  campaign: CampaignLocation, checkinId: string, _alert: NormalizedAlert,
): PromotionDraft {
  return {
    owner_id: campaign.owner_id,
    campaign_id: campaign.id,
    finding_id: buildPromotionDraftFindingId(checkinId),
    lead_agent: "echo",
    review_agents: ["echo", "story", "nexus"],
    task_title: "Draft disaster-relief promotion for the campaign",
    suggested_action:
      "Draft a short share post with the campaign link and image for IFund-owned channels. " +
      "The owner authorized promotion by answering yes to the disaster check-in; " +
      "do not publish anything without the promotion flow.",
    discussion: [
      {
        agent: "echo",
        kind: "rule_based_proposal",
        text:
          "ECHO: Draft a short disaster-relief share post for this campaign " +
          "(one concrete ask, campaign link, campaign image). Area verified by " +
          "an authoritative alert; the need is the owner's own statement.",
      },
    ],
  };
}
