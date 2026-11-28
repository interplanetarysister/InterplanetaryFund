// Disaster-response watch (edge slice): pure-logic tests for
// supabase/functions/ifund-disaster-watch/disasterLib.ts.
// Small hand-built fixtures only — no live network in tests.
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeNwsFeature,
  normalizeUsgsFeature,
  normalizeGdacsFeature,
  gdacsPolygonFromCollection,
  nwsZonePolygonFromFeature,
  usgsRadiusKm,
  pointInPolygonGeometry,
  pointInRing,
  haversineKm,
  withinRadiusKm,
  centroidOfGeometry,
  alertMatchesCampaign,
  areaBucket,
  buildDedupeKey,
  isWithinDedupeWindow,
  buildCheckinMessage,
  buildPromotionDraft,
  buildPromotionDraftFindingId,
  GDACS_FALLBACK_RADIUS_KM,
  DEDUPE_WINDOW_MS,
} from "../supabase/functions/ifund-disaster-watch/disasterLib.ts";

const squarePolygon = {
  type: "Polygon",
  coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
};
const multiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
    [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]],
  ],
};

function nwsFeature(overrides = {}) {
  return {
    type: "Feature",
    geometry: squarePolygon,
    properties: {
      id: "urn:oid:test-flash-flood-1",
      status: "Actual",
      messageType: "Alert",
      event: "Flash Flood Warning",
      severity: "Severe",
      areaDesc: "Brunswick, VA",
      headline: "Flash Flood Warning for Brunswick, VA",
      sent: "2026-11-27T01:00:00-05:00",
      expires: "2026-11-27T06:00:00-05:00",
      ...overrides,
    },
  };
}

function campaign(overrides = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    owner_id: "22222222-2222-2222-2222-222222222222",
    title: "Help rebuild after the flood",
    cover_image_url: "https://example.com/cover.jpg",
    map_latitude: 5,
    map_longitude: 5,
    ...overrides,
  };
}

// --- NWS normalization + filters -------------------------------------------

test("NWS: qualifying Flash Flood Warning normalizes with polygon + centroid", () => {
  const alert = normalizeNwsFeature(nwsFeature());
  assert.ok(alert);
  assert.equal(alert.source, "nws");
  assert.equal(alert.source_event_id, "urn:oid:test-flash-flood-1");
  assert.equal(alert.disaster_type, "flood");
  assert.equal(alert.severity, "severe");
  assert.equal(alert.area_description, "Brunswick, VA");
  assert.equal(alert.geometry.type, "Polygon");
  assert.deepEqual(alert.centroid, [5, 5]);
  assert.equal(alert.radius_km, null);
});

test("NWS: non-warning events, watches and statements are excluded", () => {
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Flash Flood Watch" })), null);
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Flood Statement" })), null);
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Tornado Watch" })), null);
  // Warnings of other kinds still map when the event name is known.
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Tornado Warning" })).disaster_type, "tornado");
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Hurricane Warning" })).disaster_type, "hurricane");
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Blizzard Warning" })).disaster_type, "winter_storm");
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Red Flag Warning" })).disaster_type, "wildfire");
  assert.equal(normalizeNwsFeature(nwsFeature({ event: "Unknown Thing Warning" })), null);
});

test("NWS: only Extreme/Severe severity qualifies", () => {
  assert.ok(normalizeNwsFeature(nwsFeature({ severity: "Extreme" })));
  assert.ok(normalizeNwsFeature(nwsFeature({ severity: "Severe" })));
  assert.equal(normalizeNwsFeature(nwsFeature({ severity: "Moderate" })), null);
  assert.equal(normalizeNwsFeature(nwsFeature({ severity: "Minor" })), null);
});

test("NWS: only Actual status and Alert/Update message types qualify", () => {
  assert.equal(normalizeNwsFeature(nwsFeature({ status: "Test" })), null);
  assert.equal(normalizeNwsFeature(nwsFeature({ status: "Exercise" })), null);
  assert.ok(normalizeNwsFeature(nwsFeature({ messageType: "Update" })));
  assert.equal(normalizeNwsFeature(nwsFeature({ messageType: "Cancel" })), null);
  assert.equal(normalizeNwsFeature(nwsFeature({ messageType: "Alert", status: "actual" })).disaster_type, "flood");
});

test("NWS: null geometry without zones is stored but never matched", () => {
  const feature = nwsFeature();
  feature.geometry = null;
  const alert = normalizeNwsFeature(feature);
  assert.ok(alert);
  assert.equal(alert.geometry, null);
  assert.equal(alert.centroid, null);
  assert.equal(alert.zone_urls, null);
  assert.equal(alertMatchesCampaign(alert, campaign()), false);
});

test("NWS: null geometry keeps affectedZones for the zone fallback", () => {
  const feature = nwsFeature({
    affectedZones: [
      "https://api.weather.gov/zones/forecast/MDZ024",
      "https://api.weather.gov/zones/county/MDC047",
    ],
  });
  feature.geometry = null;
  const alert = normalizeNwsFeature(feature);
  assert.ok(alert);
  assert.equal(alert.geometry, null);
  assert.equal(alert.centroid, null);
  assert.deepEqual(alert.zone_urls, [
    "https://api.weather.gov/zones/forecast/MDZ024",
    "https://api.weather.gov/zones/county/MDC047",
  ]);
  // Still unmatched until the edge function resolves a zone polygon.
  assert.equal(alertMatchesCampaign(alert, campaign()), false);
});

test("NWS zones: polygon extracted from a zone Feature, bare or GeometryCollection", () => {
  // Bare Polygon feature.
  assert.deepEqual(
    nwsZonePolygonFromFeature({ type: "Feature", geometry: squarePolygon }),
    squarePolygon,
  );
  // Live shape (verified 2026-11-27, zone MDZ024): GeometryCollection
  // holding a MultiPolygon then a Polygon — the first polygon wins.
  assert.deepEqual(
    nwsZonePolygonFromFeature({
      type: "Feature",
      geometry: { type: "GeometryCollection", geometries: [multiPolygon, squarePolygon] },
    }),
    multiPolygon,
  );
  // No polygon anywhere: Point-only collection, null geometry, junk.
  assert.equal(
    nwsZonePolygonFromFeature({
      type: "Feature",
      geometry: {
        type: "GeometryCollection",
        geometries: [{ type: "Point", coordinates: [0, 0] }],
      },
    }),
    null,
  );
  assert.equal(nwsZonePolygonFromFeature({ type: "Feature", geometry: null }), null);
  assert.equal(nwsZonePolygonFromFeature(null), null);
});

test("NWS zone fallback: a geometry-less alert matches once its zone polygon is attached", () => {
  const feature = nwsFeature({
    affectedZones: ["https://api.weather.gov/zones/forecast/MDZ024"],
  });
  feature.geometry = null;
  const alert = normalizeNwsFeature(feature);
  assert.ok(alert);
  // Before zone resolution (the old behaviour): never matches.
  assert.equal(alertMatchesCampaign(alert, campaign()), false);
  // The edge function attaches the first zone polygon, exactly as
  // fetchNwsZoneGeometry does; the alert then matches by containment.
  alert.geometry = squarePolygon;
  alert.centroid = centroidOfGeometry(squarePolygon);
  assert.equal(alertMatchesCampaign(alert, campaign()), true);
  assert.equal(
    alertMatchesCampaign(alert, campaign({ map_latitude: 15, map_longitude: 15 })),
    false,
  );
});

// --- USGS normalization + radius -------------------------------------------

function usgsFeature(overrides = {}) {
  return {
    type: "Feature",
    id: "us6000test1",
    geometry: { type: "Point", coordinates: [-122.1, 47.6, 10] },
    properties: {
      mag: 5.5,
      place: "10 km W of Everett, Washington",
      time: 1795754676196,
      title: "M 5.5 - 10 km W of Everett, Washington",
      ...overrides,
    },
  };
}

test("USGS: magnitude >= 5.0 normalizes with radius heuristic", () => {
  const alert = normalizeUsgsFeature(usgsFeature());
  assert.ok(alert);
  assert.equal(alert.source, "usgs");
  assert.equal(alert.disaster_type, "earthquake");
  assert.equal(alert.magnitude, 5.5);
  assert.deepEqual(alert.centroid, [-122.1, 47.6]);
  assert.equal(alert.radius_km, usgsRadiusKm(5.5));
  assert.equal(alert.area_description, "10 km W of Everett, Washington");
});

test("USGS: magnitude below 5.0 is excluded", () => {
  assert.equal(normalizeUsgsFeature(usgsFeature({ mag: 4.9 })), null);
  assert.equal(normalizeUsgsFeature(usgsFeature({ mag: 2.5 })), null);
  assert.ok(normalizeUsgsFeature(usgsFeature({ mag: 5.0 })));
});

test("USGS: radius heuristic values and 500 km cap", () => {
  assert.equal(usgsRadiusKm(5.0), 25);
  assert.equal(usgsRadiusKm(6.0), 50);
  assert.equal(usgsRadiusKm(7.0), 100);
  assert.equal(usgsRadiusKm(8.0), 200);
  assert.equal(usgsRadiusKm(9.0), 400);
  assert.equal(usgsRadiusKm(9.5), 500);
  assert.equal(usgsRadiusKm(10.0), 500);
});

// --- GDACS normalization + filters -----------------------------------------

function gdacsFeature(overrides = {}) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [80.2, 15.8] },
    properties: {
      eventtype: "TC",
      eventid: 1001346,
      episodeid: 10,
      alertlevel: "Red",
      iscurrent: "true",
      country: "India",
      name: "Tropical Cyclone MURASU-26",
      fromdate: "2026-11-01T00:00:00",
      todate: "2026-11-03T06:00:00",
      url: { geometry: "https://www.gdacs.org/gdacsapi/api/polygons/getgeometry?eventtype=TC&eventid=1001346&episodeid=10" },
      ...overrides,
    },
  };
}

test("GDACS: qualifying current Red cyclone normalizes with fallback radius", () => {
  const alert = normalizeGdacsFeature(gdacsFeature());
  assert.ok(alert);
  assert.equal(alert.source, "gdacs");
  assert.equal(alert.source_event_id, "TC-1001346-10");
  assert.equal(alert.disaster_type, "hurricane");
  assert.equal(alert.severity, "red");
  assert.deepEqual(alert.centroid, [80.2, 15.8]);
  assert.equal(alert.radius_km, GDACS_FALLBACK_RADIUS_KM);
  assert.equal(alert.radius_km, 100);
  assert.ok(alert.polygon_url.includes("getgeometry"));
});

test("GDACS: drought excluded; only current Orange/Red and known types qualify", () => {
  assert.equal(normalizeGdacsFeature(gdacsFeature({ eventtype: "DR" })), null);
  assert.equal(normalizeGdacsFeature(gdacsFeature({ iscurrent: "false" })), null);
  assert.equal(normalizeGdacsFeature(gdacsFeature({ alertlevel: "Green" })), null);
  assert.equal(normalizeGdacsFeature(gdacsFeature({ alertlevel: "Orange" })).severity, "orange");
  assert.equal(normalizeGdacsFeature(gdacsFeature({ eventtype: "EQ" })).disaster_type, "earthquake");
  assert.equal(normalizeGdacsFeature(gdacsFeature({ eventtype: "FL" })).disaster_type, "flood");
  assert.equal(normalizeGdacsFeature(gdacsFeature({ eventtype: "WF" })).disaster_type, "wildfire");
  assert.equal(normalizeGdacsFeature(gdacsFeature({ eventtype: "VO" })).disaster_type, "volcano");
  assert.equal(normalizeGdacsFeature(gdacsFeature({ eventtype: "XX" })), null);
});

test("GDACS: live iscurrent serialization is the quoted string \"'true'\"", () => {
  // Verified live 2026-11-27: the GDACS API returns iscurrent as "'true'" /
  // "'false'" (single quotes included) — events4app returns "'true'" for all
  // 100 current events. The unquoted fixture form must keep working, and the
  // quoted live form must normalize; otherwise this source could never
  // produce an alert while the poll still returned 200 with no feed error.
  assert.ok(normalizeGdacsFeature(gdacsFeature({ iscurrent: "'true'" })));
  assert.equal(
    normalizeGdacsFeature(gdacsFeature({ iscurrent: "'true'" })).source_event_id,
    "TC-1001346-10",
  );
  assert.equal(normalizeGdacsFeature(gdacsFeature({ iscurrent: "'false'" })), null);
  assert.ok(normalizeGdacsFeature(gdacsFeature({ iscurrent: true })));
});

test("GDACS: polygon endpoint collection yields the Polygon, not the centroid Point", () => {
  const collection = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [80.2, 15.8] }, properties: {} },
      { type: "Feature", geometry: squarePolygon, properties: {} },
    ],
  };
  assert.deepEqual(gdacsPolygonFromCollection(collection), squarePolygon);
  assert.equal(gdacsPolygonFromCollection({ type: "FeatureCollection", features: [] }), null);
  assert.equal(gdacsPolygonFromCollection({ type: "FeatureCollection", features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [1, 2] }, properties: {} },
  ] }), null);
});

// --- Geometry ----------------------------------------------------------------

test("point-in-polygon: Polygon inside / outside / edge / unclosed ring", () => {
  assert.equal(pointInPolygonGeometry(5, 5, squarePolygon), true);
  assert.equal(pointInPolygonGeometry(15, 5, squarePolygon), false);
  assert.equal(pointInPolygonGeometry(-1, 5, squarePolygon), false);
  // On the edge counts as inside.
  assert.equal(pointInPolygonGeometry(0, 5, squarePolygon), true);
  assert.equal(pointInPolygonGeometry(5, 0, squarePolygon), true);
  // Ring without a duplicated closing vertex still works.
  const unclosed = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10]]] };
  assert.equal(pointInPolygonGeometry(5, 5, unclosed), true);
  assert.equal(pointInPolygonGeometry(15, 5, unclosed), false);
  // Hole: inside the hole is outside.
  const withHole = {
    type: "Polygon",
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
    ],
  };
  assert.equal(pointInPolygonGeometry(5, 5, withHole), false);
  assert.equal(pointInPolygonGeometry(1, 1, withHole), true);
  assert.equal(pointInPolygonGeometry(5, 5, null), false);
});

test("point-in-polygon: MultiPolygon matches either part", () => {
  assert.equal(pointInPolygonGeometry(5, 5, multiPolygon), true);
  assert.equal(pointInPolygonGeometry(25, 25, multiPolygon), true);
  assert.equal(pointInPolygonGeometry(15, 15, multiPolygon), false);
});

test("radius matching: haversine distance and within-radius boundary", () => {
  // ~111 km per degree of latitude.
  assert.ok(haversineKm(0, 0, 1, 0) > 110 && haversineKm(0, 0, 1, 0) < 112);
  assert.equal(haversineKm(47.6, -122.1, 47.6, -122.1), 0);
  assert.equal(withinRadiusKm(47.6, -122.1, 47.6, -122.1, 25), true);
  assert.equal(withinRadiusKm(48.6, -122.1, 47.6, -122.1, 25), false);
  assert.equal(withinRadiusKm(47.8, -122.1, 47.6, -122.1, 25), true);
});

test("centroid: Point, Polygon and MultiPolygon", () => {
  assert.deepEqual(centroidOfGeometry({ type: "Point", coordinates: [-122.1, 47.6] }), [-122.1, 47.6]);
  assert.deepEqual(centroidOfGeometry(squarePolygon), [5, 5]);
  assert.deepEqual(centroidOfGeometry(multiPolygon), [5, 5]);
  assert.equal(centroidOfGeometry(null), null);
});

test("matching: polygon alerts match by containment, point alerts by radius", () => {
  const nws = normalizeNwsFeature(nwsFeature());
  assert.equal(alertMatchesCampaign(nws, campaign()), true);
  assert.equal(alertMatchesCampaign(nws, campaign({ map_latitude: 15, map_longitude: 15 })), false);
  const usgs = normalizeUsgsFeature(usgsFeature());
  assert.equal(alertMatchesCampaign(usgs, campaign({ map_latitude: 47.6, map_longitude: -122.1 })), true);
  assert.equal(alertMatchesCampaign(usgs, campaign({ map_latitude: 47.6, map_longitude: -120 })), false);
});

// --- Dedupe ------------------------------------------------------------------

test("dedupe: key is campaign|type|1-degree area bucket", () => {
  assert.equal(areaBucket([5.4, 5.4]), "5|5");
  assert.equal(areaBucket([-122.1, 47.6]), "48|-122");
  assert.equal(areaBucket(null), null);
  const key = buildDedupeKey("camp-1", "flood", [5.4, 5.4]);
  assert.equal(key, "camp-1|flood|5|5");
  // Same disaster, nearby centroid in the same 1-degree bucket: same key.
  assert.equal(buildDedupeKey("camp-1", "flood", [5.2, 5.4]), key);
  // Different campaign, type, or bucket: different key.
  assert.notEqual(buildDedupeKey("camp-2", "flood", [5.4, 5.4]), key);
  assert.notEqual(buildDedupeKey("camp-1", "tornado", [5.4, 5.4]), key);
  assert.notEqual(buildDedupeKey("camp-1", "flood", [15.4, 5.4]), key);
  assert.equal(buildDedupeKey("camp-1", "flood", null), null);
});

test("dedupe: 72h window logic", () => {
  assert.equal(DEDUPE_WINDOW_MS, 72 * 60 * 60 * 1000);
  const now = Date.parse("2026-11-27T12:00:00Z");
  assert.equal(isWithinDedupeWindow("2026-11-27T11:00:00Z", now), true);
  assert.equal(isWithinDedupeWindow("2026-11-24T12:00:01Z", now), true);
  assert.equal(isWithinDedupeWindow("2026-11-24T12:00:00Z", now), false);
  assert.equal(isWithinDedupeWindow("2026-11-20T12:00:00Z", now), false);
  assert.equal(isWithinDedupeWindow("2026-11-28T12:00:00Z", now), false);
  assert.equal(isWithinDedupeWindow("not-a-date", now), false);
});

// --- Messages + drafts ---------------------------------------------------------

test("message builder: names the disaster and area, with the two-action ask", () => {
  const alert = normalizeNwsFeature(nwsFeature());
  const message = buildCheckinMessage(alert);
  assert.equal(
    message.body,
    "A flash flood warning is active for Brunswick, VA. Are you in need of emergency assistance because of this?",
  );
  assert.ok(message.title.includes("Flash Flood Warning"));
  const quake = normalizeUsgsFeature(usgsFeature());
  const quakeMessage = buildCheckinMessage(quake);
  assert.equal(
    quakeMessage.body,
    "An earthquake has been reported near 10 km W of Everett, Washington. Are you in need of emergency assistance because of this?",
  );
  const gdacs = normalizeGdacsFeature(gdacsFeature());
  assert.equal(
    buildCheckinMessage(gdacs).body,
    "A hurricane warning is active for India. Are you in need of emergency assistance because of this?",
  );
});

test("draft builder: editorial-review shape with agreed finding_id", () => {
  const checkinId = "abcdef12-3456-7890-abcd-ef1234567890";
  assert.equal(buildPromotionDraftFindingId(checkinId), "disaster_promotion_abcdef12");
  const alert = normalizeNwsFeature(nwsFeature());
  const draft = buildPromotionDraft(campaign(), checkinId, alert);
  assert.equal(draft.owner_id, campaign().owner_id);
  assert.equal(draft.campaign_id, campaign().id);
  assert.equal(draft.finding_id, "disaster_promotion_abcdef12");
  assert.ok(draft.finding_id.length >= 4 && draft.finding_id.length <= 64);
  // Mirrors the ifund_disaster_checkin_answer insert exactly (the live path):
  // ECHO leads the drafting task; the agents draft the post at review time.
  assert.equal(draft.lead_agent, "echo");
  assert.deepEqual(draft.review_agents, ["echo", "story", "nexus"]);
  assert.equal(draft.task_title, "Draft disaster-relief promotion for the campaign");
  assert.ok(draft.suggested_action.includes("campaign link and image"));
  assert.ok(draft.suggested_action.includes("do not publish anything without the promotion flow"));
  assert.equal(draft.discussion[0].agent, "echo");
  assert.equal(draft.discussion[0].kind, "rule_based_proposal");
  assert.ok(draft.discussion[0].text.includes("owner's own statement"));
  // The row instructs the agents to draft from the campaign; it carries no
  // pre-built post text, so it is identical with or without a cover image.
  const noImage = buildPromotionDraft(campaign({ cover_image_url: null }), checkinId, alert);
  assert.deepEqual(noImage, draft);
});
