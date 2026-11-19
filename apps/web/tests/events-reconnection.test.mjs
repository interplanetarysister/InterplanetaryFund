import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateExternalCheckout } from "../src/api/events.js";

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
  assert.match(mobile, /path="\/events\/?:id?"/);
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
