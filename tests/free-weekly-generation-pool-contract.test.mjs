import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read(
  "../supabase/migrations/20261128120000_ifund_free_weekly_generation_pool.sql",
);

// Owner directive 2026-11-28: the free allowance is 15 generations per
// rolling 7 days for every non-subscriber, spendable on any kind. These
// source contracts pin the shape so a later migration cannot quietly
// restore the lifetime cap or the free-account membership wall.
test("weekly pool counts a rolling 7-day window, not all time", () => {
  assert.match(migration, /completed_at>statement_timestamp\(\)-interval '7 days'/);
  assert.match(migration, /'window','rolling_7_day'/);
  assert.match(migration, /v_count>=15/);
  assert.match(migration, /interval '30 minutes'/);
});

test("non-subscribers route to the pool from the shared content reserve", () => {
  assert.match(
    migration,
    /v_ent->>'status'='trialing' or v_ent->>'tier'='free' then\s+return public\.ifund_trial_ai_generation_reserve/,
  );
  assert.match(
    migration,
    /v_ent->>'status'='trialing' or v_ent->>'tier'='free' then\s+return public\.ifund_trial_ai_generation_status/,
  );
});

test("subscriber, admin and day-pass routing is preserved", () => {
  // Paid members still resolve their verified monthly payment and 50 cap.
  assert.match(migration, /ifund_premium_ai_paid_payment_id\(\)/);
  assert.match(migration, /'state','monthly_limit','limit',50/);
  assert.match(migration, /'state','admin_exempt','limit',null/);
  // Day passes still fall through to membership_required in content reserve:
  // the only membership_required return sits after the pool routing and the
  // admin exemption, on the unpaid path.
  assert.match(migration, /'state','membership_required','limit',50/);
  // Direct trial-reserve calls from active non-trial accounts keep the
  // prior untracked exemption.
  assert.match(
    migration,
    /coalesce\(\(v_ent->>'active'\)::boolean,false\)\s+and v_ent->>'status'<>'trialing' then\s+return jsonb_build_object\('allowed',true,'state','paid_or_admin_exempt'/,
  );
});

test("migration is additive and source-only, with grants restated", () => {
  assert.match(migration, /SOURCE ONLY — not applied to production/);
  assert.doesNotMatch(migration, /drop table|drop function|alter table .* drop/i);
  assert.match(migration, /grant execute on function public\.ifund_ai_content_reserve\(uuid,text\) to authenticated/);
  assert.match(migration, /grant execute on function public\.ifund_trial_ai_generation_status\(\) to authenticated/);
});

test("member-facing copy states the weekly rule", () => {
  const balance = read("../apps/web/src/components/subscriptions/TrialCreationBalance.jsx");
  assert.match(balance, /15 creations per week on a rolling 7-day cycle/);
  assert.match(balance, /info\.free_pool/);
  const preview = read("../worker/services/campaign-preview.js");
  assert.match(preview, /Your 15 free AI creations for this week are used/);
  assert.doesNotMatch(preview, /15 trial AI creations/);
});
