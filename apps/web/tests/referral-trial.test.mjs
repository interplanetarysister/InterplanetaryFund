import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trialAccessState } from "../src/lib/referralTrial.mjs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("shareable code is collected through registration and claimed only after verified login",()=>{
 const root=read("../src/components/agents/GlobalAgentCompanion.jsx");
 const bridge=read("../src/components/referrals/ReferralTrialBootstrap.jsx");
 assert.match(root,/<ReferralTrialBootstrap \/>/);
 assert.match(bridge,/location\.pathname !== "\/register"/);
 assert.match(bridge,/user\.email_confirmed_at/);
 assert.match(bridge,/validReferralCode\(code\)/);
 assert.match(bridge,/rpc\("ifund_agent_referral_status"\)/);
 assert.match(bridge,/rpc\("ifund_claim_campaign_referral"/);
 assert.match(bridge,/sessionStorage\.removeItem\(PENDING_REFERRAL_KEY\)/);
});
test("dashboard offers real referral link without claiming premium checkout is live",()=>{
 const dashboard=read("../src/pages/Dashboard.jsx");
 const card=read("../src/components/referrals/ReferralRewards.jsx");
 assert.match(dashboard,/<ReferralRewards ownerId=\{user\?\.id\} \/>/);
 assert.match(card,/https:\/\/interplanetaryfund\.com\/register\?ref=/);
 assert.match(card,/publishes their first campaign/);
 assert.match(card,/referral hours are saved for launch/);
 assert.match(card,/One code per new account/);
 assert.doesNotMatch(card,/startSubscription|BILLING.SUBSCRIPTION|PayPal checkout/);
});
test("a passed trial expiry reads as ended, not as current access",()=>{
 // Bug 3 (2026-11-25 audit): ReferralRewards rendered "Agent access through
 // {trial_expires_at}" unconditionally, so a passed date (11/23/2026 seen live
 // on Nov 25) read as current access.
 const past = new Date(Date.now() - 24*60*60*1000).toISOString();
 const future = new Date(Date.now() + 24*60*60*1000).toISOString();
 assert.equal(trialAccessState(true, past), "expired");
 assert.equal(trialAccessState(true, future), "active");
 assert.equal(trialAccessState(false, future), "inactive");
 assert.equal(trialAccessState(true, null), "inactive");
 assert.equal(trialAccessState(true, "not-a-date"), "inactive");
 const card=read("../src/components/referrals/ReferralRewards.jsx");
 assert.match(card,/trialAccessState\(/);
 assert.match(card,/trialState === "expired"/);
 assert.match(card,/trialState === "active"/);
 assert.match(card,/Agent trial access ended/);
 assert.match(card,/Refer members or choose a plan to continue/);
 assert.match(card,/Agent access through/);
});
test("referral credit is a single provider-independent, published campaign grant",()=>{
 const sql=read("../../../supabase/migrations/20261120194050_ifund_agent_trial_referrals_20261120.sql");
 assert.match(sql,/ifund_referral_claims\s*\(/);
 assert.match(sql,/referred_id uuid primary key/);
 assert.match(sql,/new\.status<>'active'/);
 assert.match(sql,/rewarded_at is null/);
 assert.match(sql,/qualifying_campaign_id=new\.id/);
 assert.match(sql,/pending_hours\+24/);
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/desired_monthly_price_cents integer not null default 499/);
 assert.match(sql,/revoke all on public\.ifund_referral_trial_accounts from public,anon,authenticated/);
});
