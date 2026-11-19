import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateExternalCheckout } from "../src/api/events.js";
import { owningNavigationTab } from "../src/lib/navigation.js";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");

test("reconnected events detail guards the owner check until the event exists", () => {
  const page = read("../src/pages/Events.jsx");
  assert.match(page, /const isOwner=Boolean\(event\?\.id\s*&&\s*user\?\.id\s*&&\s*ownedEvents\.some/);
  assert.match(page, /Loading event/);
  assert.match(page, /This event could not be loaded/);
});

test("all restored public routes resolve to real components and remain fail-closed", () => {
  const app = read("../src/App.jsx");
  const manifest = JSON.parse(read("../ci/route-acceptance.json"));
  for (const [route, component] of [
    ["/events", "Events"],
    ["/events/:id", "Events"],
    ["/fundraising-tips", "FundraisingTips"],
    ["/planetary-impact", "AdminSustainability"],
  ]) {
    assert.ok(app.includes(`path="${route}" element={<${component} />}`), route);
    const row = manifest.routes.find(item => item.route === route);
    assert.equal(row?.component, component, route);
    assert.equal(row?.source_status, "not_verified", route);
  }
});

test("event API, dashboard and native routes are connected without checkout capture", () => {
  const api = read("../src/api/events.js");
  const dashboard = read("../src/pages/Dashboard.jsx");
  const widget = read("../src/components/dashboard/EventsDashboardSection.jsx");
  const mobile = read("../src/MobileStoreApp.jsx");
  const account = read("../src/mobile/MobileStoreAccount.jsx");
  const mobileEvents = read("../src/mobile/MobileStoreEvents.jsx");
  assert.match(api, /verifyAccountLifecycle/);
  assert.match(api, /requireCurrentTerms/);
  assert.match(dashboard, /<EventsDashboardSection\s*\/>/);
  assert.match(widget, /listOwnerEvents/);
  assert.ok(mobile.includes('path="/events" element={<MobileStoreEvents/>}'));
  assert.ok(mobile.includes('path="/events/:id" element={<MobileStoreEvents/>}'));
  assert.match(account, /<MobileStoreEvents embedded\s*\/>/);
  assert.match(mobileEvents, /listMyEventActivity/);
  assert.doesNotMatch(api, /\.from\(["']ifund_(?:donations|ledger_entries)["']\)/);
});

test("external event checkout accepts official links but rejects unsafe destinations", () => {
  for (const [url, provider] of [
    ["https://www.eventbrite.com/e/benefit-123", "eventbrite"],
    ["https://www.paypal.com/paypalme/charity", "paypal"],
    ["https://example.32auctions.com/auction/item", "32auctions"],
  ]) assert.equal(validateExternalCheckout(url, provider).valid, true, url);
  for (const [url, provider] of [
    ["http://eventbrite.com/e/benefit", "eventbrite"],
    ["https://eventbrite.com.evil.example/e/benefit", "eventbrite"],
    ["https://user:pass@eventbrite.com/e/benefit", "eventbrite"],
    ["https://eventbrite.com:8443/e/benefit", "eventbrite"],
    ["https://eventbrite.com/", "eventbrite"],
    ["https://eventbrite.com/e/benefit", "paypal"],
  ]) assert.equal(validateExternalCheckout(url, provider).valid, false, url);
});

test("planetary impact filters environmental campaigns before the public row limit", () => {
  const page = read("../src/pages/AdminSustainability.jsx");
  const api = read("../src/api/publicData.js");
  const start = api.indexOf("export async function listActiveCampaigns(");
  const end = api.indexOf("export async function getCampaignDetail(", start);
  assert.ok(start >= 0 && end > start, "public campaign function exists");
  const fn = api.slice(start, end);
  assert.match(page, /listActiveCampaigns\(\{ limit: 500, category: "environment" \}\)/);
  assert.match(fn, /category === "environment"/);
  assert.match(fn, /query = query\.eq\("category", "environment"\)/);
  assert.ok(fn.indexOf('query.eq("category", "environment")') < fn.indexOf(".limit(max)"));
  assert.match(fn, /throw new Error\("Unsupported public campaign category filter\."/);
});

test("restored public routes retain an Explore back-navigation destination", () => {
  for (const route of ["/events", "/events/123", "/fundraising-tips", "/planetary-impact"]) {
    assert.equal(owningNavigationTab(route, false), "/discover", route);
    assert.equal(owningNavigationTab(route, true), "/discover", route);
  }
});

test("event management requires an owner-matching row after account changes", () => {
  const page = read("../src/pages/Events.jsx");
  assert.match(page, /row\.id===eventId\s*&&\s*row\.owner_id===current\.id/);
  assert.match(page, /row\.id===event\.id\s*&&\s*row\.owner_id===user\.id/);
  assert.doesNotMatch(page, /ownedEvents\.some\(row=>row\.id===event\.id\)\)/);
});
