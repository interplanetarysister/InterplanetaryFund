import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").toLowerCase();
const schema = read("../supabase/migrations/20261025100627_ifund_phase1_application_runtime_schema.sql");
const profileGrants = read("../supabase/migrations/20261030152523_ifund_profile_column_scoped_client_grants.sql");
const campaignGrants = read("../supabase/migrations/20261105193521_ifund_campaign_write_privilege_hardening_20261105.sql");

test("nonfinancial preview tables enable owner-enforced RLS", () => {
  for (const name of ["ifund_profiles", "ifund_campaigns", "ifund_posts", "ifund_connections"]) {
    assert.match(schema, new RegExp("alter table public\\." + name + " enable row level security"));
  }
});

test("campaign and post writes are limited to explicit client-owned columns", () => {
  assert.match(campaignGrants, /revoke insert, update[\s\S]*on table public\.ifund_campaigns, public\.ifund_posts[\s\S]*from authenticated/);
  assert.match(campaignGrants, /grant insert \(owner_id, title, summary, story, category, goal_amount, cover_image_url, status\)/);
  assert.match(campaignGrants, /grant update \(title, summary, story, category, goal_amount, cover_image_url, status\)/);
  assert.match(campaignGrants, /grant insert \(author_id, body\)/);
  assert.doesNotMatch(campaignGrants, /grant\s+(?:select,)?insert(?:,update)?(?:,delete)?\s+on table public\.ifund_(?:campaigns|posts)\s+to authenticated/);
});

test("profile writes are limited to handle and display name", () => {
  assert.match(profileGrants, /revoke insert, update on table public\.ifund_profiles from authenticated/);
  assert.match(profileGrants, /grant insert \(id, handle, display_name\)/);
  assert.match(profileGrants, /grant update \(handle, display_name\)/);
});

test("provider connections never have direct client write grants", () => {
  assert.match(schema, /grant select on public\.ifund_connections to authenticated/);
  assert.doesNotMatch(schema, /grant\s+(?:insert|update|delete).*?on\s+public\.ifund_connections/);
});

test("campaigns and posts survive attempted deletion of the owning auth user", () => {
  assert.match(schema, /owner_id uuid not null references auth\.users\(id\) on delete restrict/);
  assert.match(schema, /author_id uuid not null references auth\.users\(id\) on delete restrict/);
});
