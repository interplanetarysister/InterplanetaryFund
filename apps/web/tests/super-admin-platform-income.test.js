import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page=readFileSync(new URL("../src/pages/AdminFinance.jsx",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../../supabase/migrations/20261112230000_ifund_super_admin_platform_income.sql",import.meta.url),"utf8");

test("super admin platform income excludes campaign principal",()=>{
  assert.match(migration,/ifund_current_user_is_verified_super_admin/);
  assert.match(migration,/allocation_status='platform_support'/);
  assert.match(migration,/ifund_subscription_ledger/);
  assert.match(migration,/ifund_finance\.withdrawal/);
  assert.match(migration,/status in \('completed','paid','settled'\)/);
  assert.match(migration,/total_realized_platform_income_cents/);
  assert.doesNotMatch(migration,/ifund_donations/);
});

test("admin finance renders super-admin-only platform income breakdown",()=>{
  assert.match(page,/useSuperAdminAccess/);
  assert.match(page,/Super admin · IFund platform income/);
  assert.match(page,/Total realized income/);
  assert.match(page,/Platform support · gross/);
  assert.match(page,/PayPal processing fees/);
  assert.match(page,/Subscription ledger · net/);
  assert.match(page,/Realized 7% withdrawal fees/);
  assert.match(page,/superAdminStatus === "super-admin"/);
});
