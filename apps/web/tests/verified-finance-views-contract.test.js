import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const sql=fs.readFileSync(new URL("../../../supabase/migrations/20261109_ifund_verified_finance_views.sql",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const donor=fs.readFileSync(new URL("../src/pages/FinanceDashboard.jsx",import.meta.url),"utf8");
const admin=fs.readFileSync(new URL("../src/pages/AdminFinance.jsx",import.meta.url),"utf8");
test("all financial views include verified capture and exclude sandbox",()=>{
  for(const fn of ["ifund_owner_finance_summary","ifund_my_donation_receipts","ifund_admin_finance_summary"]){
    assert.match(sql,new RegExp(fn+"\\(\\)"));
  }
  assert.ok((sql.match(/paypal_capture_id is not null/g)||[]).length>=3);
  assert.ok((sql.match(/captured_at is not null/g)||[]).length>=3);
  assert.doesNotMatch(sql,/ifund_paypal_sandbox_(orders|events)/);
  assert.doesNotMatch(sql,/create policy.*for insert/i);
});
test("admin authorization uses verified server-side check",()=>{
  assert.match(sql,/ifund_current_user_is_verified_admin\(\)/);
  assert.match(sql,/raise exception 'Verified administrator only'/);
  assert.match(app, /<AdminAccess><Navigate to="\/finances#platform-finance" replace \/><\/AdminAccess>/);
});
test("finance functions cannot execute as anonymous",()=>{
  for(const fn of ["ifund_owner_finance_summary","ifund_my_donation_receipts","ifund_admin_finance_summary"])
    assert.ok(sql.includes("revoke all on function public."+fn+"() from public,anon"));
});
test("frontend explicitly routes member and admin finances and never writes ledger",()=>{
  assert.match(app,/path="\/finances"/);
  assert.match(app,/path="\/ledger"/);
  assert.match(app,/path="\/giving"/);
  assert.match(app,/path="\/admin\/finance"/);
  assert.match(donor,/rpc\("ifund_my_donation_receipts"\)/);
  assert.match(donor,/rpc\("ifund_owner_finance_summary"\)/);
  assert.match(admin,/rpc\("ifund_admin_finance_summary"\)/);
  assert.doesNotMatch(donor+admin,/\.insert\(|\.update\(|\.delete\(/);
});

test("public campaign progress is derived only from the verified totals RPC",()=>{
  const publicData=fs.readFileSync(new URL("../src/api/publicData.js",import.meta.url),"utf8");
  assert.match(publicData,/rpc\("ifund_public_campaign_funding_totals"/);
  assert.match(publicData,/return attachVerifiedFunding\(data \|\| \[\]\)/);
  assert.match(publicData,/if \(!progress\) throw new Error/);
  assert.doesNotMatch(publicData,/goal_amount\s*[-+*/]/);
});

test("single financial center retains server-verified admin boundaries",()=>{
  assert.match(donor,/useAdminAccess\(user\)/);
  assert.match(donor,/adminStatus === "admin" && <section id="platform-finance"/);
  assert.match(donor,/<AdminFinance embedded \/>/);
  assert.match(donor,/<DonutChart/);
  assert.match(admin,/<DonutChart/);
  assert.match(app,/path="\/admin\/finance"/);
  assert.match(app,/path="\/ledger" element=\{<Navigate to="\/finances#campaign-finances"/);
  assert.match(app,/path="\/giving" element=\{<Navigate to="\/finances#giving-receipts"/);
  assert.doesNotMatch(admin,/\.insert\(|\.update\(|\.delete\(/);
});
