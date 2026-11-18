import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EVENT_TYPES, ITEM_TYPES, normalizeEventInput, normalizeEventItemInput,
  validateExternalCheckout,
} from "../src/api/events.js";
import { AUTH_TABS, PUBLIC_TABS, owningNavigationTab } from "../src/lib/navigation.js";

const validDate = new Date(Date.now() + 86400000).toISOString();

test("event checkout URL allowlist accepts selected official provider hosts", () => {
  assert.equal(validateExternalCheckout("https://www.eventbrite.com/e/community-dinner-123", "eventbrite").valid, true);
  assert.equal(validateExternalCheckout("https://www.paypal.com/paypalme/communityfund", "paypal").valid, true);
  assert.equal(validateExternalCheckout("https://example.32auctions.com/item/lot-1", "32auctions").valid, true);
  assert.equal(validateExternalCheckout("https://eventbrite.com/", "eventbrite").valid, false);
  assert.equal(validateExternalCheckout("https://eventbrite.com/e/123", "paypal").valid, false);
});

test("event checkout validation rejects lookalike, unsafe, credentialed and mismatched provider URLs", () => {
  for (const [url, provider] of [
    ["http://eventbrite.com/e/123", "eventbrite"],
    ["https://eventbrite.com.evil.example/e/123", "eventbrite"],
    ["https://eventbrite.com@evil.example/e/123", "eventbrite"],
    ["https://user:pass@eventbrite.com/e/123", "eventbrite"],
    ["https://eventbrite.com:8443/e/123", "eventbrite"],
    ["https://paypal.com/paypalme/communityfund", "eventbrite"],
    ["https://checkout.example.org/auction", "other"],
  ]) {
    assert.equal(validateExternalCheckout(url, provider).valid, false, url);
  }
});

test("event normalizer restricts categories and produces the expected owner event payload", () => {
  assert.deepEqual(EVENT_TYPES, ["benefit_dinner","art_auction","benefit_concert","community_event","gala","other"]);
  const row = normalizeEventInput({
    title: "Spring community dinner",
    description: "A benefit dinner for the neighborhood.",
    event_type: "benefit_dinner",
    starts_at: validDate,
    timezone: "America/Los_Angeles",
    location_label: "Everett, WA",
    status: "published",
    visibility: "public",
    checkout_provider: "eventbrite",
    checkout_url: "https://www.eventbrite.com/e/spring-dinner",
  });
  assert.equal(row.status, "published");
  assert.equal(row.visibility, "public");
  assert.equal(row.checkout_provider, "eventbrite");
  assert.equal(row.location_label, "Everett, WA");
  assert.equal(row.starts_at, validDate);
  assert.ok(row.published_at);
  assert.throws(() => normalizeEventInput({title:"Dinner",event_type:"not-real",starts_at:validDate}), /event type/i);
  assert.throws(() => normalizeEventInput({title:"ok title",event_type:"gala",starts_at:validDate,ends_at:validDate}), /after its start/i);
  assert.throws(() => normalizeEventInput({title:"Valid title",event_type:"gala",starts_at:validDate,timezone:"Invalid/TimeZone"}), /valid time zone/i);
});

test("event item normalizer validates ticket and auction item fields in integer cents", () => {
  assert.deepEqual(ITEM_TYPES, ["ticket","auction_item","meal","experience","raffle"]);
  const item = normalizeEventItemInput({
    item_type:"auction_item",title:"Original watercolor",estimated_value_cents:12500,
    starting_bid_cents:5000,checkout_provider:"32auctions",checkout_url:"https://32auctions.com/lot/123",
  });
  assert.equal(item.item_type,"auction_item");
  assert.equal(item.estimated_value_cents,12500);
  assert.equal(item.starting_bid_cents,5000);
  assert.throws(() => normalizeEventItemInput({item_type:"ticket",title:"Ticket",estimated_value_cents:-1}), /valid amount/i);
  assert.throws(() => normalizeEventItemInput({item_type:"not-a-type",title:"Ticket"}), /item type/i);
});


test("fundraising events are a first-class public and member mobile navigation tab", () => {
  assert.ok(AUTH_TABS.includes("/events"));
  assert.ok(PUBLIC_TABS.includes("/events"));
  assert.equal(owningNavigationTab("/events", true), "/events");
  assert.equal(owningNavigationTab("/events/123", false), "/events");
});
\ntest("event page and dashboard connect owner creation, member account activity and truthful payment disclosure", async () => {
  const [page,dashboard,widget,api,migration] = await Promise.all([
    readFile(new URL("../src/pages/Events.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard/EventsDashboardSection.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/api/events.js", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/20261118190000_ifund_fundraising_events_and_external_activity.sql", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Create a fundraising event/);
  assert.match(page, /Manage this event/);
  assert.match(page, /Already purchased externally/);
  assert.match(page, /RSVP to event/);
  assert.match(page, /not an IFund receipt or verified payment/);
  assert.match(dashboard, /EventsDashboardSection/);
  assert.match(widget, /Art auctions & experiences/);
  assert.match(widget, /Your event RSVPs/);
  assert.match(widget, /Self-reported, not verified payments/);
  assert.match(api, /verifyAccountLifecycle/);
  assert.match(api, /listOwnerEvents/);
  assert.match(api, /recordEventActivity/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /ifund_event_registrations_member_cancel/);
  assert.match(migration, /not provider-verified transactions/);
  assert.doesNotMatch(migration, /ifund_donations\s*\(/i);
  assert.doesNotMatch(migration, /ifund_ledger_entries\s*\(/i);
});

test("iPhone events view is linked to the account without adding in-app checkout", async () => {
  const [mobileApp,account,mobileEvents] = await Promise.all([
    readFile(new URL("../src/MobileStoreApp.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/mobile/MobileStoreAccount.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/mobile/MobileStoreEvents.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(mobileApp, /path="\/events"/);
  assert.match(mobileApp, /path="\/events\/:id"/);
  assert.match(account, /<MobileStoreEvents embedded \/>/);
  assert.match(mobileEvents, /listMyEventActivity/);
  assert.match(mobileEvents, /recordEventActivity/);
  assert.match(mobileEvents, /cancelEventActivity/);
  assert.match(mobileEvents, /not a verified payment or receipt/);
  assert.match(mobileApp, /No purchases, monetary gifts, fundraising checkout or paid subscriptions/);
  assert.doesNotMatch(mobileEvents, /paypal.*capture|createOrder|captureOrder/i);
});

test("event schema enforces verified identity, legal acceptance, private activity and payment separation", async () => {
  const migration = await readFile(new URL("../../../supabase/migrations/20261118190000_ifund_fundraising_events_and_external_activity.sql", import.meta.url), "utf8");
  assert.match(migration, /ifund_private\.verified_email_creator\(\)/);
  assert.match(migration, /ifund_current_user_has_current_terms\(\)/);
  assert.match(migration, /ifund_event_registrations_member_private_read/);
  assert.match(migration, /ifund_events\.status<>'published' or c\.status='active'/);
  assert.match(migration, /checkout_provider='32auctions'/);
  assert.match(migration, /char_length\(checkout_url\) <= 2048/);
  assert.doesNotMatch(migration, /event_owner_id/);
  assert.doesNotMatch(migration, /insert into public\.ifund_donations/i);
  assert.doesNotMatch(migration, /insert into public\.ifund_ledger_entries/i);
});
