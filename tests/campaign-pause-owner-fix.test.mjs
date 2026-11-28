import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20261127220000_ifund_campaign_pause_owner_fix.sql");

// D6 regression: the live UPDATE policy's WITH CHECK omitted 'paused' and the
// live transition guard rejected every non-service-role pause, so owners
// could publish but never pause. The repair migration must keep both fixes
// and preserve the surrounding live gates.
test("update policy WITH CHECK admits draft, active and paused", () => {
  assert.match(migration, /create policy ifund_campaigns_update/);
  assert.match(migration, /status = any \(array\['draft'::text, 'active'::text, 'paused'::text\]\)/);
});

test("update policy preserves the live owner, account and terms gates", () => {
  assert.match(migration, /owner_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /public\.ifund_current_account_is_active\(\)/);
  assert.match(migration, /public\.ifund_current_user_has_current_terms\(\)/);
});

test("transition guard lets the campaign owner pause their own campaign", () => {
  assert.match(migration, /new\.status = 'paused' and auth\.uid\(\) is not null and auth\.uid\(\) = old\.owner_id/);
});

test("transition guard keeps the published-to-draft prohibition and the review gate for completed", () => {
  assert.match(migration, /old\.status in \('active', 'paused', 'completed'\) and new\.status = 'draft'/);
  assert.match(migration, /campaign_status_transition_requires_review/);
  assert.match(migration, /create trigger ifund_campaign_status_transition_guard/);
});
