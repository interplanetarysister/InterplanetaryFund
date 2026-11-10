import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { campaignSetupPayload, saveCampaignSetup, loadCampaignSetup } from "../src/api/campaignSetup.js";

const OWNER = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const migration = readFileSync(new URL("../../../supabase/migrations/20261110_ifund_campaign_creation_state.sql", import.meta.url), "utf8");

test("campaign state stores optional Base44 fields privately without accepting extra keys", () => {
  const v = campaignSetupPayload({
    end_date: "2026-12-18", location: "Seattle, Washington",
    ai_profile: { tone: "hopeful", never_change: "Do not change the beneficiary", access_token: "do-not-store" },
    story_versions: [{ text: "A previous version", saved_at: "2026-11-10" }],
    cover_image_is_ai: true,
  }, 2);
  assert.equal(v.end_date, "2026-12-18");
  assert.equal(v.location, "Seattle, Washington");
  assert.equal(v.draft_step, 2);
  assert.equal(v.cover_image_is_ai, true);
  assert.deepEqual(Object.keys(v.ai_profile).sort(), ["never_change", "tone"]);
  assert.deepEqual(v.story_versions, [{ text: "A previous version", saved_at: "2026-11-10" }]);
  assert.equal(Object.hasOwn(v, "access_token"), false);
  assert.equal(v.location_lat, null);
  assert.equal(v.location_lng, null);
  assert.equal(campaignSetupPayload({}, 100).draft_step, 3);
});

test("owner-private campaign metadata is guarded by account and parent-ownership RLS", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on public\.ifund_campaign_creation_state from public, anon/i);
  assert.match(migration, /owner_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /ifund_current_user_has_current_terms/);
  assert.match(migration, /exists \(select 1 from public\.ifund_campaigns c where c\.id = campaign_id and c\.owner_id = \(select auth\.uid\(\)\)\)/i);
});

test("save rejects forged response and requires a confirmed owner", async () => {
  let writes = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: OWNER, email_confirmed_at: "2026-01-01" } } }) },
    from: () => ({ upsert: () => {
      writes++;
      return { select: () => ({ single: async () => ({ data: { owner_id: CAMPAIGN, campaign_id: CAMPAIGN } }) }) };
    } }),
  };
  await assert.rejects(saveCampaignSetup(client, CAMPAIGN, {}, 1), /not confirmed/);
  assert.equal(writes, 1);
  client.auth.getUser = async () => ({ data: { user: { id: OWNER, email_confirmed_at: null } } });
  await assert.rejects(saveCampaignSetup(client, CAMPAIGN, {}, 1), /confirmed account/);
  assert.equal(writes, 1);
});

test("cross-owner metadata reads fail closed", async () => {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: OWNER, email_confirmed_at: "2026-01-01" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { campaign_id: CAMPAIGN, owner_id: "33333333-3333-4333-8333-333333333333" } }),
          }),
        }),
      }),
    }),
  };
  await assert.rejects(loadCampaignSetup(client, CAMPAIGN), /not verified for your account/);
});
