import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const dialog = read("../src/components/payments/CampaignDonationDialog.jsx");
const worker = read("../../../workers/ifund-payments/worker.js");
const ledger = read("../../../supabase/functions/ifund-payment-ledger/index.ts");
const inbox = read("../src/lib/inbox.js");
const migration = read("../../../supabase/migrations/20261121193000_ifund_verified_donation_messages.sql");

test("cardholder name is not a required IFund card field", () => {
  assert.match(dialog, /Name on card \(optional\)/);
  assert.match(dialog, /card\.NameField\(\)\.render\(nameHost\.current\)/);
  assert.match(dialog, /IFund does not require your name/);
});

test("cardholder name remains optional unless the card provider requests it", () => {
  assert.ok(dialog.includes("Name on card (optional)"));
  assert.match(dialog, /your card provider requests it/);
});

test("campaign support messages are optional and length limited", () => {
  assert.match(dialog, /supportMessage/);
  assert.match(dialog, /maxLength={500}/);
  assert.match(worker, /input\.support_message\.trim\(\)\.length>500/);
  assert.match(ledger, /p\.support_message\.trim\(\)\.length>500/);
});

test("support message is part of the idempotent signed payment intent", () => {
  assert.match(dialog, /support_message:visibility\.supportMessage/);
  assert.match(worker, /support_message:typeof input\.support_message/);
  assert.match(ledger, /support_message:typeof p\.support_message/);
  assert.match(ledger, /existing\.support_message!==/);
});

test("messages enter the private owner inbox only after verified capture", () => {
  assert.match(migration, /new\.paypal_capture_verified_at is null/);
  assert.match(migration, /after insert on public\.ifund_donations/);
  assert.match(migration, /on conflict \(donation_id\) do nothing/);
  assert.match(migration, /owner_id = \(select auth\.uid\(\)\)/);
  assert.match(inbox, /ifund_campaign_donation_messages/);
  assert.match(inbox, /donationMessages/);
  assert.match(inbox, /markCampaignDonationMessageDone/);
  assert.match(inbox, /read_at/);
});

test("message notification is deduplicated with the durable inbox delivery", () => {
  assert.match(migration, /if v_delivery_id is not null/);
  assert.match(migration, /ifund_notifications/);
  assert.match(migration, /'donation_message', '\/inbox'/);
});

test("donation dialog payment actions do not use sticky negative-margin overlap", () => {
  assert.match(dialog, /aria-label="Payment actions" className="space-y-3 border-t/);
  assert.doesNotMatch(dialog, /sticky bottom-0[^\n]*-mx-5/);
});
