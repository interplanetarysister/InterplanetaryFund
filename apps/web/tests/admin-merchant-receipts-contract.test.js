import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../../supabase/migrations/20261110_ifund_platform_support_merchant_receipts.sql", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/pages/AdminFinance.jsx", import.meta.url), "utf8");

test("merchant receipts require verified admin authorization and exclude anonymous users", () => {
  assert.match(sql, /security definer/i);
  assert.match(sql, /ifund_current_user_is_verified_admin\(\)/);
  assert.match(sql, /revoke all on function public\.ifund_admin_paypal_merchant_receipts\(\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.ifund_admin_paypal_merchant_receipts\(\) to authenticated/i);
  assert.match(sql, /x\.allocation_status,x\.last_provider_verified_at/);
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /provider_status = 'S'/);
  assert.doesNotMatch(sql, /insert into public\.ifund_donations|update public\.ifund_ledger_entries/i);
});

test("admin financial screen displays unallocated merchant receipts separately", () => {
  assert.match(ui, /rpc\("ifund_admin_paypal_merchant_receipts"\)/);
  assert.match(ui, /PayPal platform donations and merchant receipts/);
  assert.match(ui, /Neither group is included in campaign fundraising or owner withdrawals/);
  assert.match(ui, /source_site === "unattributed" \? "Unverified"/);
  assert.match(ui, /state\.rows\.reduce/);
  assert.match(ui, /platform\.reduce/);
  assert.match(ui, /IFund platform donation/);
  assert.match(ui, /unmatched\.length/);
  assert.match(ui, /allocation_status==="platform_support"/);
  assert.match(ui, /allocation_status==="unattributed"/);
});
