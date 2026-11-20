import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
test("referral credit is a single provider-independent, published campaign grant",()=>{
 const sql=read("../../../supabase/migrations/20261120195000_ifund_agent_trial_referrals.sql");
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
