import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../../supabase/migrations/20261110_ifund_admin_unattributed_merchant_receipts.sql", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/pages/AdminFinance.jsx", import.meta.url), "utf8");

test("merchant receipts require verified admin authorization and exclude anonymous users", () => {
  assert.match(sql, /security definer/i);
  assert.match(sql, /ifund_current_user_is_verified_admin\(\)/);
  assert.match(sql, /revoke all on function public\.ifund_admin_unattributed_paypal_receipts\(\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.ifund_admin_unattributed_paypal_receipts\(\) to authenticated/i);
  assert.match(sql, /allocation_status = 'unattributed'/);
  assert.match(sql, /provider_status = 'S'/);
  assert.doesNotMatch(sql, /insert into public\.ifund_donations|update public\.ifund_ledger_entries/i);
});

test("admin financial screen displays unallocated merchant receipts separately", () => {
  assert.match(ui, /rpc\("ifund_admin_unattributed_paypal_receipts"\)/);
  assert.match(ui, /Unattributed PayPal merchant receipts/);
  assert.match(ui, /excluded from campaign totals and withdrawals/);
  assert.match(ui, /source_site === "unattributed" \? "Unverified"/);
  assert.match(ui, /state\.rows\.reduce/);
  assert.match(ui, /state\.unattributed\.reduce/);
});
