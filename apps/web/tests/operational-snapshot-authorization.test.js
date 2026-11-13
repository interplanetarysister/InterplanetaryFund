import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261113_ifund_super_admin_operational_snapshot.sql");
const ui = read("../src/pages/AdminFinance.jsx");

test("operational snapshot is available only after verified super-admin authorization", () => {
  assert.match(migration, /auth\.uid\(\) is null/);
  assert.match(migration, /ifund_current_user_is_verified_super_admin\(\)/);
  assert.match(migration, /raise exception 'Verified super administrator only'/);
  assert.match(migration, /revoke all on function public\.ifund_super_admin_operational_snapshot\(\) from public, anon/);
  assert.match(migration, /grant execute on function public\.ifund_super_admin_operational_snapshot\(\) to authenticated/);
  assert.match(migration, /set search_path = ''/);
});

test("snapshot contains read-only operational counts with no payment mutations", () => {
  for (const name of ["queued_workflow_jobs", "failed_workflow_jobs", "overdue_workflow_jobs",
    "recent_workflow_events", "unresolved_platform_incidents", "unattributed_merchant_receipts",
    "active_subscription_plans", "provider_verified_subscription_plans"]) {
    assert.match(migration, new RegExp(name));
  }
  assert.doesNotMatch(migration, /\b(insert into|delete from|update\s+[a-z_]+\s+set|execute payout)\b/i);
});

test("admin monitoring fails closed and distinguishes no data from zero", () => {
  assert.match(ui, /client\.rpc\("ifund_super_admin_operational_snapshot"\)/);
  assert.match(ui, /superAdminStatus === "super-admin"/);
  assert.match(ui, /Operational telemetry is unavailable/);
  assert.match(ui, /Zero database jobs or incidents does not verify/);
  assert.match(ui, /n === null \|\| n === undefined \|\| n === ""/);
});
