import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("shared trial quota is server-owned and denies anonymous writes",()=>{
 const sql=read("../../../supabase/migrations/20261122123000_ifund_trial_shared_15_ai_generations.sql");
 assert.match(sql,/owner_id uuid not null references auth.users\(id\)/);
 assert.match(sql,/primary key\(owner_id,request_id\)/);
 assert.match(sql,/v_count>=15/);
 assert.match(sql,/v_ent->>'status'<>'trialing'/);
 assert.match(sql,/ifund_trial_ai_generation_reserve/);
 assert.match(sql,/ifund_trial_ai_generation_complete/);
 assert.match(sql,/ifund_trial_ai_generation_release/);
 assert.match(sql,/ifund_trial_ai_generation_status/);
 assert.match(sql,/revoke all on public.ifund_trial_ai_generations from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public.ifund_trial_ai_generation_reserve\(uuid,text\) to authenticated/);
});
test("generated stories and images share single trial content allowance",()=>{
 const story=read("../../../worker/services/campaign-preview.js");
 const image=read("../../../worker/imageStudio.js");
 const enhance=read("../../../worker/imageImprove.js");
 const helper=read("../../../worker/trialAiContent.js");
 const sql=read("../../../supabase/migrations/20261122123000_ifund_trial_shared_15_ai_generations.sql");
 assert.match(story,/reserveTrialContent\(env,trialJwt,"campaign_story"/);
 assert.match(story,/completeTrialContent\(env,trialJwt,trialReceipt/);
 assert.match(image,/reserveTrialContent\(env,account.jwt,"image"/);
 assert.match(enhance,/reserveTrialContent\(env,account.jwt,"image_edit"/);
 for(const mod of [story,image,enhance]){
  assert.match(mod,/releaseTrialContent\(/);
  assert.match(mod,/trialReceipt/);
 }
 assert.match(helper,/ifund_trial_ai_generation_reserve/);
 assert.match(helper,/ifund_trial_ai_generation_complete/);
 assert.match(helper,/cannot delete active reservations/);
 assert.ok(sql.includes("revoke all on function public.ifund_trial_ai_generation_release(uuid,text) from public,anon,authenticated"));
});
test("premium offers appear in context without blocking campaign editing",()=>{
 const c=read("../src/components/subscriptions/PremiumOpportunity.jsx");
 const balance=read("../src/components/subscriptions/TrialCreationBalance.jsx");
 const campaign=read("../src/pages/CreateCampaign.jsx");
 const dashboard=read("../src/pages/Dashboard.jsx");
 const image=read("../src/pages/AIImageStudio.jsx");
 const panel=read("../src/components/agents/AgentSidePanel.jsx");
 assert.match(c,/to="\/subscriptions"/);
 assert.match(balance,/rpc\("ifund_trial_ai_generation_status"\)/);
 assert.match(balance,/15 free AI creations/);
 assert.match(campaign,/<TrialCreationBalance compact/);
 assert.match(campaign,/Save private draft/);
 assert.match(dashboard,/<PremiumOpportunity context="dashboard"/);
 assert.match(image,/<PremiumOpportunity context="artwork"/);
 assert.match(panel,/<PremiumOpportunity context="agent" compact/);
});
