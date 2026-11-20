// Static source guards for the inactive-by-default agent referral trial SQL.
// The behavioral gates need hosted payment/member acceptance and are recorded
// separately; these assertions prevent accidental source regressions.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261120194050_ifund_agent_trial_referrals_20261120.sql",
    import.meta.url,
  ),
  "utf8",
);

test("referral code generation retries a bounded number of unique-code collisions", () => {
  assert.match(migration, /v_attempt integer;/);
  assert.match(migration, /for v_attempt in 1\.\.5 loop/);
  assert.match(migration, /exception when unique_violation then/);
  assert.match(migration, /if v_attempt=5 then raise; end if;/);
  assert.match(migration, /on conflict\(owner_id\) do nothing/);
});

test("replaced subscription definer restates private-schema public revocation", () => {
  assert.match(
    migration,
    /revoke all on function ifund_story_runtime\.subscription\(\) from public,anon,authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function ifund_story_runtime\.subscription\(\) to authenticated;/,
  );
});

test("SQL uses PostgreSQL GREATEST syntax rather than a nonexistent catalog function", () => {
  assert.doesNotMatch(migration, /pg_catalog\.greatest\(/);
  assert.doesNotMatch(migration, /pg_catalog\.least\(/);
  assert.match(migration, /greatest\(trial_expires_at,statement_timestamp\(\)\)/);
});

test("referral trial remains inactive by default and maps only to basic L1", () => {
  assert.match(migration, /enabled boolean not null default false/);
  assert.match(migration, /paid_enrollment_ready boolean not null default false/);
  assert.match(migration, /when 'basic' then 1/);
  assert.doesNotMatch(migration, /when 'basic' then 2/);
});
