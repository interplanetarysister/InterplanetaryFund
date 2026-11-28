import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { loadComponent } from "./helpers/render.js";
import {
  loadMyDisasterCheckins,
  answerDisasterCheckin,
  normalizeDisasterCheckin,
} from "../src/lib/disasterCheckins.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const publicData = read("../src/api/publicData.js");
const discover = read("../src/pages/Discover.jsx");
const detail = read("../src/pages/CampaignDetail.jsx");
const notificationsPage = read("../src/pages/Notifications.jsx");
const homePage = read("../src/pages/Home.jsx");
const checkinCardSrc = read("../src/components/notifications/DisasterCheckinCard.jsx");
const checkinsLib = read("../src/lib/disasterCheckins.js");

const ID = "33333333-3333-4333-8333-333333333333";
const CHECKIN_ID = "44444444-4444-4444-8444-444444444444";
const OWNER = "11111111-1111-4111-8111-111111111111";

let CampaignCard;
let DisasterCheckinCard;
let sortDisasterReliefFirst;
test.before(async () => {
  const cardModule = await loadComponent("src/components/campaigns/CampaignCard.jsx");
  CampaignCard = cardModule.default;
  sortDisasterReliefFirst = cardModule.sortDisasterReliefFirst;
  DisasterCheckinCard = (await loadComponent("src/components/notifications/DisasterCheckinCard.jsx")).default;
});

const renderCard = (campaign) => renderToStaticMarkup(
  createElement(MemoryRouter, null, createElement(CampaignCard, { campaign })));
const renderCheckin = (checkin, client = {}) => renderToStaticMarkup(
  createElement(DisasterCheckinCard, { checkin, client }));

const sampleCheckin = {
  checkin_id: CHECKIN_ID,
  alert_id: "55555555-5555-4555-8555-555555555555",
  campaign_id: ID,
  campaign_title: "Rebuild the River Road shelter",
  alert_title: "Flash Flood Warning is active for Everett",
  alert_area: "Everett, WA",
  disaster_type: "flood",
  severity: "Severe",
  asked_at: "2026-11-26T18:00:00Z",
};

// --- publicData: the two new columns are selected and mapped. ---

test("publicData selects disaster_relief and disaster_relief_since and maps them", () => {
  assert.match(publicData, /disaster_relief,disaster_relief_since/, "PUBLIC_COLUMNS includes both new columns");
  assert.match(publicData, /disaster_relief: row\.disaster_relief === true/, "mapping keeps the flag boolean, never truthy-by-default");
  assert.match(publicData, /disaster_relief_since: row\.disaster_relief_since \|\| null/, "mapping carries the flag timestamp");
});

// --- CampaignCard badge: renders when flagged, never otherwise. ---

test("CampaignCard shows the disaster-relief badge only when the flag is set", () => {
  const flagged = renderCard({ id: ID, title: "Shelter rebuild", status: "active", disaster_relief: true });
  assert.match(flagged, /Disaster relief — verified area/);
  const plain = renderCard({ id: ID, title: "Shelter rebuild", status: "active" });
  assert.doesNotMatch(plain, /Disaster relief — verified area/);
  const falseFlag = renderCard({ id: ID, title: "Shelter rebuild", status: "active", disaster_relief: false });
  assert.doesNotMatch(falseFlag, /Disaster relief — verified area/);
});

test("CampaignCard badge is not triggered by the disaster_relief category alone", () => {
  // The category and the boolean flag are distinct: a campaign in the
  // Disaster Relief category that was never check-in confirmed gets no badge.
  const html = renderCard({ id: ID, title: "Shelter rebuild", status: "active", category: "disaster_relief" });
  assert.doesNotMatch(html, /Disaster relief — verified area/);
  assert.doesNotMatch(html, /verified need/i, "badge copy never claims a verified need");
});

// --- Discover: flagged-first ordering + disaster section. ---

test("Discover sortDisasterReliefFirst puts flagged campaigns first, stably", () => {
  assert.equal(typeof sortDisasterReliefFirst, "function", "sort helper is exported from CampaignCard.jsx and re-exported by Discover.jsx");
  const a = { id: "a", title: "A" };
  const b = { id: "b", title: "B", disaster_relief: true };
  const c = { id: "c", title: "C" };
  const d = { id: "d", title: "D", disaster_relief: true };
  assert.deepEqual(sortDisasterReliefFirst([a, b, c, d]).map((x) => x.id), ["b", "d", "a", "c"]);
  assert.deepEqual(sortDisasterReliefFirst([a, c]).map((x) => x.id), ["a", "c"], "unflagged order is unchanged");
  assert.deepEqual(sortDisasterReliefFirst([a, b, c, d]).length, 4, "no campaign is dropped by the sort");
  assert.deepEqual([a, b, c, d].map((x) => x.id), ["a", "b", "c", "d"], "the input list is not mutated");
});

test("Discover renders a disaster section naming the flagged campaigns", () => {
  assert.match(discover, /const filtered = sortDisasterReliefFirst\(/, "the grid list is sorted flagged-first");
  assert.match(discover, /const reliefCampaigns = filtered\.filter\(\(c\) => c\.disaster_relief === true\)/, "flagged campaigns are separated for the section");
  assert.match(discover, /aria-label="Disaster relief campaigns"/, "disaster section is labelled");
  assert.match(discover, /Disaster relief — verified area/, "section uses the badge copy");
  assert.match(discover, /The area is verified; the need described is each campaign owner/, "section states the honest explainer");
  assert.doesNotMatch(discover, /verified need/i, "section never claims a verified need");
  assert.match(discover, /<Link to=\{\`\/campaign\/\$\{c\.id\}\`\}[^>]*>\{c\.title\}<\/Link>/, "section links each flagged campaign to its detail page");
});

// --- Home: disaster section appears only when flagged campaigns exist. ---

test("Home renders a disaster section naming the flagged campaigns, only when any exist", () => {
  assert.match(homePage, /import \{ listActiveCampaigns \} from "@\/api\/publicData"/, "Home fetches public campaigns");
  assert.match(homePage, /items\.filter\(\(c\) => c\.disaster_relief === true\)\.slice\(0, 5\)/, "Home keeps only flagged campaigns, capped at five");
  assert.match(homePage, /reliefCampaigns\.length > 0 && \(/, "the section renders only when flagged campaigns exist");
  assert.match(homePage, /aria-label="Disaster relief campaigns"/, "disaster section is labelled");
  assert.match(homePage, /Disaster relief — verified area/, "section uses the badge copy");
  assert.match(homePage, /The area is verified; the need described is each campaign owner/, "section states the honest explainer");
  assert.doesNotMatch(homePage, /verified need/i, "section never claims a verified need");
  assert.match(homePage, /<Link to=\{\`\/campaign\/\$\{c\.id\}\`\}[^>]*>\{c\.title\}<\/Link>/, "section links each flagged campaign to its detail page");
  assert.match(homePage, /<Link to="\/discover"[^>]*>See all disaster-relief campaigns/, "section links on to Discover");
});

test("Home disaster fetch fails silently so the homepage never breaks", () => {
  // listActiveCampaigns throws when Supabase is unconfigured and when the
  // funding RPC fails; the homepage must still render its hero either way.
  assert.match(homePage, /\.catch\(\(\) => \{ if \(active\) setReliefCampaigns\(\[\]\); \}\)/, "a failed fetch resolves to an empty section, not an error state");
  assert.doesNotMatch(homePage, /setReliefError|reliefError|We couldn't load disaster/, "no disaster error UI exists on the homepage");
});

// --- CampaignDetail: badge + honest explainer. ---

test("CampaignDetail shows the badge and the honest area-vs-need explainer", () => {
  assert.match(detail, /campaign\.disaster_relief === true && <Badge[^>]*>Disaster relief — verified area<\/Badge>/, "detail page shows the badge when flagged");
  assert.match(detail, /This campaign.{0,10}s area was verified against an authoritative disaster alert/, "explainer says the area was verified");
  assert.match(detail, /The need described here is the owner.{0,10}s own statement — it has not been independently verified/, "explainer says the need is the owner's statement, not verified");
  assert.doesNotMatch(detail, /verified need/i, "detail page never writes 'verified need'");
});

// --- disasterCheckins lib: fake-client RPC contract. ---

function clientFor({ rows = [sampleCheckin], answerRow = null, failRpc = false, userId = OWNER } = {}) {
  const calls = [];
  const client = {
    auth: {
      async getUser() {
        return { data: { user: { id: userId, email_confirmed_at: "2026-11-19T12:00:00Z" } }, error: null };
      },
    },
    async rpc(name, args) {
      calls.push([name, args]);
      if (failRpc) return { data: null, error: { message: "denied" } };
      if (name === "ifund_my_disaster_checkins") return { data: rows, error: null };
      if (name === "ifund_disaster_checkin_answer") {
        return { data: [answerRow || { checkin_id: args.p_checkin_id, status: args.p_answer, campaign_id: ID, disaster_relief: args.p_answer === "yes" }], error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  };
  return { client, calls };
}

test("loadMyDisasterCheckins lists the caller's pending check-ins via the RPC", async () => {
  const { client, calls } = clientFor();
  const rows = await loadMyDisasterCheckins(client);
  assert.deepEqual(calls, [["ifund_my_disaster_checkins", undefined]]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].checkin_id, CHECKIN_ID);
  assert.equal(rows[0].campaign_title, "Rebuild the River Road shelter");
  assert.equal(rows[0].alert_area, "Everett, WA");
});

test("loadMyDisasterCheckins drops rows without a valid check-in id", async () => {
  const { client } = clientFor({ rows: [sampleCheckin, { checkin_id: "not-a-uuid", campaign_title: "Bogus" }] });
  const rows = await loadMyDisasterCheckins(client);
  assert.equal(rows.length, 1);
});

test("answerDisasterCheckin calls the answer RPC with the exact check-in id and answer", async () => {
  for (const answer of ["yes", "no"]) {
    const { client, calls } = clientFor();
    const result = await answerDisasterCheckin(client, CHECKIN_ID, answer);
    assert.deepEqual(calls, [["ifund_disaster_checkin_answer", { p_checkin_id: CHECKIN_ID, p_answer: answer }]]);
    assert.equal(result.status, answer);
    assert.equal(result.disaster_relief, answer === "yes");
  }
});

test("answerDisasterCheckin rejects bad ids, bad answers, and unconfirmed RPC replies", async () => {
  const { client } = clientFor();
  await assert.rejects(() => answerDisasterCheckin(client, "not-a-uuid", "yes"), /Invalid disaster check-in/);
  await assert.rejects(() => answerDisasterCheckin(client, CHECKIN_ID, "maybe"), /Answer must be 'yes' or 'no'/);
  await assert.rejects(() => answerDisasterCheckin(clientFor({ failRpc: true }).client, CHECKIN_ID, "yes"));
  const mismatch = clientFor({ answerRow: { checkin_id: CHECKIN_ID, status: "pending", campaign_id: ID } });
  await assert.rejects(() => answerDisasterCheckin(mismatch.client, CHECKIN_ID, "yes"), /not confirmed/);
});

test("check-in lib requires a verified signed-in owner, like notifications.js", async () => {
  const guest = clientFor({ userId: "not-a-uuid" });
  await assert.rejects(() => loadMyDisasterCheckins(guest.client), /Sign in/);
  await assert.rejects(() => answerDisasterCheckin(guest.client, CHECKIN_ID, "yes"), /Sign in/);
});

test("normalizeDisasterCheckin fills safe defaults for missing fields", () => {
  const row = normalizeDisasterCheckin({ checkin_id: CHECKIN_ID });
  assert.equal(row.campaign_title, "Your campaign");
  assert.equal(row.alert_title, "A disaster alert");
  assert.equal(row.alert_area, "");
});

// --- DisasterCheckinCard: renders alert/campaign info and both buttons. ---

test("DisasterCheckinCard renders the alert, area, disaster, and campaign with both answers", () => {
  const html = renderCheckin(sampleCheckin);
  assert.match(html, /Flash Flood Warning is active for Everett/);
  assert.match(html, /Everett, WA/);
  assert.match(html, /Flood/);
  assert.match(html, /Severe/);
  assert.match(html, /Rebuild the River Road shelter/);
  assert.match(html, /Yes, I need emergency assistance/);
  assert.match(html, /No, I(?:&#x27;|'|’)m safe/);
  assert.match(html, /Are you in need of emergency assistance because of this\?/);
  assert.match(html, /min-h-11/, "both answer buttons meet the 44px touch target");
});

test("DisasterCheckinCard wires Yes to 'yes' and No to 'no' through the answer RPC", () => {
  // No DOM harness exists in the web suite, so the click itself is pinned
  // at the source level while the RPC call it triggers is proven above
  // against a fake client with exact arguments.
  assert.match(checkinCardSrc, /import \{ answerDisasterCheckin \} from "@\/lib\/disasterCheckins"/);
  assert.match(checkinCardSrc, /onClick=\{\(\) => answer\("yes"\)\}/);
  assert.match(checkinCardSrc, /onClick=\{\(\) => answer\("no"\)\}/);
  assert.match(checkinCardSrc, /await answerDisasterCheckin\(client, checkin\.checkin_id, value\)/);
  assert.match(checkinsLib, /\.rpc\("ifund_disaster_checkin_answer", \{\s*p_checkin_id: checkinId,\s*p_answer: answer,\s*\}\)/);
  // After answering, the card shows a confirmation and a Dismiss that
  // removes it via onAnswered — never re-asking for the same event.
  assert.match(checkinCardSrc, /Thank you — your campaign is now flagged for disaster relief\./);
  assert.match(checkinCardSrc, /Thank you — we(?:'|&#x27;)re glad you(?:'|&#x27;)re safe\./);
  assert.match(checkinCardSrc, /onClick=\{\(\) => onAnswered\?\.\(checkin\)\}/);
});

// --- Notifications wiring: check-ins load with notifications and render. ---

test("Notifications wires pending check-ins in alongside loadNotifications", () => {
  assert.match(notificationsPage, /import \{ loadMyDisasterCheckins \} from "@\/lib\/disasterCheckins"/);
  assert.match(notificationsPage, /import DisasterCheckinCard from "@\/components\/notifications\/DisasterCheckinCard"/);
  assert.match(notificationsPage, /pending=await loadMyDisasterCheckins\(authClient\(\)\)/, "check-ins load in the same load() as notifications");
  assert.match(notificationsPage, /<DisasterCheckinCard key=\{checkin\.checkin_id\} checkin=\{checkin\} client=\{authClient\(\)\}/, "one card renders per pending check-in");
  assert.match(notificationsPage, /onAnswered=\{\(answered\)=>setCheckins\(current=>current\.filter\(item=>item\.checkin_id!==answered\.checkin_id\)\)\}/, "answering removes the card from the list");
  assert.match(notificationsPage, /aria-label="Disaster check-ins"/, "check-in section is labelled");
});
