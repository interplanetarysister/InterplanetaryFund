// Disaster-watch edge-function handler tests (node:test, no Deno needed).
//
// The handler is imported directly (Node v24 type-stripping) with
// globalThis.Deno and globalThis.fetch stubbed, following the pattern in
// tests/subscription-atomic-handler.test.js. The fake Supabase backend is an
// in-memory store that enforces the same unique(alert_id, campaign_id)
// constraint as the migration, so the poll loop's behaviour on re-polls and
// on insert failures is exercised exactly as the live edge function sees it.
//
// Regression coverage for the ask-loop repair (2026-11-27): the 72h dedupe
// window alone does not stop a re-ask for the SAME alert once the first ask
// ages past 72h — without the per-event skip the handler inserted a
// duplicate notification, then threw on the unique constraint and 500'd
// the whole poll (repeating every 10 minutes while the alert stayed
// active). A single failing check-in insert likewise aborted the whole
// poll and orphaned its notification.

import test from "node:test";
import assert from "node:assert/strict";

const everettCampaignA = {
  id: "camp-a",
  owner_id: "owner-a",
  title: "Flood relief for Everett",
  cover_image_url: null,
  map_latitude: 47.98,
  map_longitude: -122.2,
};

const everettCampaignB = {
  id: "camp-b",
  owner_id: "owner-b",
  title: "Flood help in Everett",
  cover_image_url: null,
  map_latitude: 48.0,
  map_longitude: -122.15,
};

// One NWS Flash Flood Warning whose polygon covers both Everett campaigns.
function nwsFeature() {
  return {
    type: "Feature",
    properties: {
      status: "Actual",
      messageType: "Alert",
      event: "Flash Flood Warning",
      severity: "Severe",
      id: "nws-ff-1",
      headline: "Flash Flood Warning",
      areaDesc: "Everett, WA",
      sent: "2026-11-27T10:00:00Z",
      expires: "2026-11-28T10:00:00Z",
    },
    geometry: {
      type: "Polygon",
      coordinates: [[[-122.3, 47.9], [-122.1, 47.9], [-122.1, 48.05], [-122.3, 48.05], [-122.3, 47.9]]],
    },
  };
}

// Same warning with NO geometry, but with an affectedZones URL — the
// zone fallback must resolve it to a polygon covering Everett.
function nwsFeatureNoGeometry() {
  const f = nwsFeature();
  f.geometry = null;
  f.properties.affectedZones = ["https://api.weather.gov/zones/county/WAC033"];
  return f;
}

// Zone endpoint shape (verified live 2026-11-27): a Feature whose geometry
// is a GeometryCollection holding the zone Polygon(s).
function zoneFeature() {
  return {
    type: "Feature",
    properties: { id: "WAC033", name: "Snohomish" },
    geometry: {
      type: "GeometryCollection",
      geometries: [{
        type: "Polygon",
        coordinates: [[[-122.3, 47.9], [-122.1, 47.9], [-122.1, 48.05], [-122.3, 48.05], [-122.3, 47.9]]],
      }],
    },
  };
}

function makeFake({ campaigns, failCheckinFor = new Set(), nws = nwsFeature } = {}) {
  const store = {
    alerts: [],
    notifications: [],
    checkins: [],
    nextAlert: 1,
    nextNotif: 1,
    nextCheckin: 1,
  };

  async function fakeFetch(rawUrl, options = {}) {
    const url = String(rawUrl);
    const method = (options.method || "GET").toUpperCase();
    // Public disaster feeds. Zone URLs must be matched before the general
    // weather.gov branch: the zone fallback fetches them separately.
    if (url.startsWith("https://api.weather.gov/zones/")) return Response.json(zoneFeature());
    if (url.startsWith("https://api.weather.gov/")) return Response.json({ features: [nws()] });
    if (url.startsWith("https://earthquake.usgs.gov/")) return Response.json({ features: [] });
    if (url.startsWith("https://www.gdacs.org/")) return Response.json({ features: [] });
    // Cron token authorization always passes in these tests.
    if (url.endsWith("/rpc/ifund_disaster_authorize")) return Response.json(true);
    const u = new URL(url);
    const path = u.pathname.replace("/rest/v1/", "");
    if (path.startsWith("ifund_disaster_alerts") && method === "POST") {
      const rows = JSON.parse(options.body);
      const out = rows.map((r) => {
        const existing = store.alerts.find(
          (a) => a.source === r.source && a.source_event_id === r.source_event_id,
        );
        if (existing) return { id: existing.id, source: r.source, source_event_id: r.source_event_id };
        const row = { id: `alert-${store.nextAlert++}`, source: r.source, source_event_id: r.source_event_id };
        store.alerts.push(row);
        return row;
      });
      return Response.json(out);
    }
    if (path.startsWith("ifund_campaigns") && method === "GET") return Response.json(campaigns);
    if (path.startsWith("ifund_disaster_checkins") && method === "GET") {
      const select = u.searchParams.get("select") || "";
      if (select === "asked_at") {
        const key = (u.searchParams.get("dedupe_key") || "").replace(/^eq\./, "");
        const gte = (u.searchParams.get("asked_at") || "").replace(/^gte\./, "");
        return Response.json(
          store.checkins
            .filter((c) => c.dedupe_key === key && (!gte || c.asked_at >= gte))
            .map((c) => ({ asked_at: c.asked_at })),
        );
      }
      // Per-event check: select=id&alert_id=eq...&campaign_id=eq...
      const alertId = (u.searchParams.get("alert_id") || "").replace(/^eq\./, "");
      const campaignId = (u.searchParams.get("campaign_id") || "").replace(/^eq\./, "");
      return Response.json(
        store.checkins
          .filter((c) => c.alert_id === alertId && c.campaign_id === campaignId)
          .map((c) => ({ id: c.id })),
      );
    }
    if (path.startsWith("ifund_notifications") && method === "POST") {
      const rows = JSON.parse(options.body);
      const out = rows.map((r) => {
        const row = { id: `notif-${store.nextNotif++}`, ...r };
        store.notifications.push(row);
        return row;
      });
      return Response.json(out);
    }
    if (path.startsWith("ifund_notifications") && method === "DELETE") {
      const id = (u.searchParams.get("id") || "").replace(/^eq\./, "");
      store.notifications = store.notifications.filter((n) => n.id !== id);
      return new Response("", { status: 204 });
    }
    if (path.startsWith("ifund_disaster_checkins") && method === "POST") {
      const rows = JSON.parse(options.body);
      for (const r of rows) {
        if (failCheckinFor.has(r.campaign_id)) {
          return Response.json({ message: "synthetic check-in insert failure" }, { status: 500 });
        }
        if (store.checkins.some((c) => c.alert_id === r.alert_id && c.campaign_id === r.campaign_id)) {
          return Response.json(
            { message: 'duplicate key value violates unique constraint "ifund_disaster_checkins_alert_id_campaign_id_key"' },
            { status: 409 },
          );
        }
      }
      for (const r of rows) {
        store.checkins.push({
          id: `checkin-${store.nextCheckin++}`,
          asked_at: new Date().toISOString(),
          ...r,
        });
      }
      return new Response("", { status: 201 });
    }
    throw new Error("Unexpected fetch: " + method + " " + url);
  }
  return { store, fakeFetch };
}

// Stub the Deno runtime before importing the handler: env for the Supabase
// URL/key, serve to capture the request handler.
let handler;
globalThis.Deno = {
  env: {
    get: (name) =>
      ({ SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-key" })[name],
  },
  serve: (fn) => {
    handler = fn;
  },
};
await import("../supabase/functions/ifund-disaster-watch/index.ts");
assert.equal(typeof handler, "function", "edge handler was registered via Deno.serve");

async function runWatch() {
  const res = await handler(
    new Request("https://example.invalid/edge", {
      method: "POST",
      headers: { "x-ifund-disaster-token": "a".repeat(64) },
    }),
  );
  return { status: res.status, data: await res.json() };
}

test("first poll creates one check-in linked to one notification", async () => {
  const { store, fakeFetch } = makeFake({ campaigns: [everettCampaignA] });
  globalThis.fetch = fakeFetch;
  const { status, data } = await runWatch();
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.alerts_fetched, 1);
  assert.equal(data.matched, 1);
  assert.equal(data.checkins_created, 1);
  assert.equal(data.dedupe_skipped, 0);
  assert.deepEqual(data.checkin_errors, []);
  assert.equal(store.notifications.length, 1);
  assert.equal(store.checkins.length, 1);
  assert.equal(store.checkins[0].notification_id, store.notifications[0].id);
  assert.equal(store.checkins[0].status, "pending");
  // Regression (2026-11-27): the check-in notification must carry a
  // canonical_operation_id like every other server-side ifund_notifications
  // writer. The column has no DDL anywhere in the repo, so its nullability
  // on the live table is unproven from source — an insert that omits it bets
  // the whole poll on NULL being accepted. The value reuses the dedupe key,
  // so one (campaign, disaster, area) ask has one operation identity.
  assert.equal(
    store.notifications[0].canonical_operation_id,
    "disaster-checkin:v1:" + store.checkins[0].dedupe_key,
  );
  assert.ok(store.notifications[0].canonical_operation_id.length <= 256);
});

test("same alert re-polled after the 72h window is skipped, not re-asked and not a 500", async () => {
  const { store, fakeFetch } = makeFake({ campaigns: [everettCampaignA] });
  globalThis.fetch = fakeFetch;
  assert.equal((await runWatch()).status, 200);
  assert.equal(store.checkins.length, 1);
  // Age the ask past the 72h dedupe window: the alert is still active and
  // still matches, so only the per-event skip can stop a re-ask.
  store.checkins[0].asked_at = new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString();
  const second = await runWatch();
  assert.equal(second.status, 200);
  assert.equal(second.data.checkins_created, 0);
  assert.equal(second.data.dedupe_skipped, 1);
  assert.deepEqual(second.data.checkin_errors, []);
  assert.equal(store.notifications.length, 1, "no duplicate notification for the same event");
  assert.equal(store.checkins.length, 1);
});

test("geometry-less NWS alert resolves its zone polygon and still asks once", async () => {
  // Regression coverage for the NWS zone fallback (2026-11-27): a
  // geometry-less warning used to be stored but never matched, so its
  // campaigns were never asked — live, 4 of 8 qualifying warnings had no
  // geometry. With the zone fallback the alert resolves to its county
  // polygon and the poll asks exactly once.
  const { store, fakeFetch } = makeFake({ campaigns: [everettCampaignA], nws: nwsFeatureNoGeometry });
  globalThis.fetch = fakeFetch;
  const { status, data } = await runWatch();
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.alerts_fetched, 1);
  assert.equal(data.matched, 1);
  assert.equal(data.checkins_created, 1);
  assert.equal(data.dedupe_skipped, 0);
  assert.deepEqual(data.checkin_errors, []);
  assert.equal(store.notifications.length, 1);
  assert.equal(store.checkins.length, 1);
});

test("a failing check-in insert does not abort the poll or orphan its notification", async () => {
  const { store, fakeFetch } = makeFake({
    campaigns: [everettCampaignA, everettCampaignB],
    failCheckinFor: new Set(["camp-a"]),
  });
  globalThis.fetch = fakeFetch;
  const { status, data } = await runWatch();
  assert.equal(status, 200);
  assert.equal(data.matched, 2);
  assert.equal(data.checkins_created, 1, "the second campaign is still asked");
  assert.equal(data.checkin_errors.length, 1);
  assert.match(data.checkin_errors[0], /camp-a/);
  assert.equal(store.checkins.length, 1);
  assert.equal(store.checkins[0].campaign_id, "camp-b");
  assert.equal(store.notifications.length, 1, "the failed campaign's notification was removed");
  assert.equal(store.notifications[0].owner_id, "owner-b");
});
