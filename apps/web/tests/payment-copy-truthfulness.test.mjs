import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dialog = readFileSync(new URL("../src/components/payments/CampaignDonationDialog.jsx", import.meta.url), "utf8");

test("payment failure copy never claims an unconfirmed checkout was absent", () => {
  assert.equal((dialog.match(/This payment needs review\. No payment was confirmed\./g) || []).length, 2);
  assert.equal((dialog.match(/No payment was started or recorded\./g) || []).length, 1);
});

test("payment status copy remains distinct from verification and reconciliation", () => {
  assert.match(dialog, /Secure checkout is unavailable\./);
  assert.match(dialog, /Checkout is temporarily unavailable\./);
  assert.match(dialog, /Payment confirmation is delayed\. Check your receipt or donation history before attempting another payment\./);
});
