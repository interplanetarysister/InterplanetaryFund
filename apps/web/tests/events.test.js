import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EVENT_TYPES, ITEM_TYPES, localDateTimeToIso, normalizeEventInput, normalizeEventItemInput,
  validateExternalCheckout,
} from "../src/api/events.js";

const validDate = new Date(Date.now() + 86400000).toISOString();

test("event checkout URL allowlist accepts selected official provider hosts", () => {
  assert.equal(validateExternalCheckout("https://www.eventbrite.com/e/community-dinner-123", "eventbrite").valid, true);
  assert.equal(validateExternalCheckout("https://www.paypal.com/paypalme/communityfund", "paypal").valid, true);
  assert.equal(validateExternalCheckout("https://example.32auctions.com/item/lot-1", "32auctions").valid, true);
});

test("event checkout validation rejects lookalike, unsafe, credentialed and mismatched provider URLs", () => {
  for (const [url, provider] of [
    ["http://eventbrite.com/e/123", "eventbrite"],
    ["https://eventbrite.com.evil.example/e/123", "eventbrite"],
    ["https://eventbrite.com@evil.example/e/123", "eventbrite"],
    ["https://user:pass@eventbrite.com/e/123", "eventbrite"],
    ["https://eventbrite.com:8443/e/123", "eventbrite"],
    ["https://eventbrite.com", "eventbrite"],
    ["https://paypal.com/?ref=campaign", "paypal"],
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
});


test("event local date and time values use the selected IANA time zone including daylight-saving rules", () => {
  assert.equal(localDateTimeToIso("2026-01-15T12:00", "America/Los_Angeles"), "2026-01-15T20:00:00.000Z");
  assert.equal(localDateTimeToIso("2026-07-15T12:00", "America/Los_Angeles"), "2026-07-15T19:00:00.000Z");
  assert.throws(() => localDateTimeToIso("2026-03-08T02:30", "America/Los_Angeles"), /daylight-saving/i);
  assert.throws(() => localDateTimeToIso("2026-04-31T12:00", "America/Los_Angeles"), /valid local event date/i);
  assert.throws(() => localDateTimeToIso("2026-04-15T12:00", "Not/A_Zone"), /valid event time zone/i);
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

test("event page and dashboard connect owner creation, member account activity and truthful payment disclosure", async () => {
  const [page,dashboard,widget,api,migration,integrityMigration] = await Promise.all([
    readFile(new URL("../src/pages/Events.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/Dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/dashboard/EventsDashboardSection.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/api/events.js", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/20261118190000_ifund_fundraising_events_and_external_activity.sql", import.meta.url), "utf8"),
    readFile(new URL("../../../supabase/migrations/20261118193000_ifund_event_activity_integrity.sql", import.meta.url), "utf8"),
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
  assert.match(integrityMigration, /checkout_provider='eventbrite' and checkout_url ~\*/i);
  assert.match(integrityMigration, /checkout_provider='paypal' and checkout_url ~\*/i);
  assert.match(integrityMigration, /ifund_guard_event_registration_cancellation/);
  assert.match(integrityMigration, /old\.status <> 'active'/);
  assert.match(integrityMigration, /new\.status <> 'cancelled'/);
  assert.match(integrityMigration, /to_jsonb\(new\)[\s\S]*to_jsonb\(old\)/);
});
