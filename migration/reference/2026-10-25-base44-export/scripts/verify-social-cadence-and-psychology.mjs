import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read = path => fs.readFileSync(path,'utf8');
const original = read('base44/shared/socialPublishingPolicy.ts');
const js = ts.transpileModule(original.replace(
  "import { hasSubscriptionLevel } from './subscriptionEntitlements.ts';",
  "const hasSubscriptionLevel = (u,n) => u.level >= n;"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { MEMBER_POST_WINDOW_MS,paidPriorityAt,canEnterMemberQueue,
  platformMayPublish,chooseNextMember,isExplicitOfficialExemption } =
  await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

assert.equal(MEMBER_POST_WINDOW_MS,43200000);
assert.equal(paidPriorityAt({created_date:'2020-01-01'}),'9999-12-31T23:59:59.000Z');
assert.equal(paidPriorityAt({first_paid_subscription_at:'2026-04-03T04:00:00Z'}),'2026-04-03T04:00:00.000Z');
assert.equal(canEnterMemberQueue({level:2,account_status:'active'},
  {status:'active',outreach_enabled:true,outreach_paused:false}),true);
assert.equal(canEnterMemberQueue({level:1,account_status:'active'},
  {status:'active',outreach_enabled:true}),false);
assert.equal(canEnterMemberQueue({level:2,account_status:'active'},
  {status:'draft',outreach_enabled:true}),false);

const t=Date.parse('2026-10-09T12:00:00.000Z');
const last={platform:'bluesky',origin:'agent_autopilot',status:'published',
  published_at:new Date(t-11*3600000).toISOString()};
assert.equal(platformMayPublish([last],'bluesky',t),false);
assert.equal(platformMayPublish([last],'mastodon',t),true);
assert.equal(platformMayPublish([{...last,published_at:new Date(t-MEMBER_POST_WINDOW_MS).toISOString()}],'bluesky',t),true);
assert.equal(platformMayPublish([{...last,origin:'ifund_official'}],'bluesky',t),true);

const oldest={id:'p1',owner_user_id:'u1',priority_at:'2026-01-01',created_date:'2026-10-01'};
const newer={id:'p2',owner_user_id:'u2',priority_at:'2026-02-01',created_date:'2026-10-01'};
assert.equal(chooseNextMember([newer,oldest],[],t).id,'p1');
assert.equal(chooseNextMember([newer,oldest],[{owner_user_id:'u1',published_at:new Date(t-86400000).toISOString()}],t).id,'p2');

const c={id:'c',status:'connected',verification_status:'verified'};
assert.equal(isExplicitOfficialExemption({status:'active',account_type:'ifund_facebook_group',connection_id:'c'},c),true);
assert.equal(isExplicitOfficialExemption({status:'active',account_type:'other',connection_id:'c'},c),false);

const scheduler=read('base44/functions/syncConnections/entry.ts');
assert.match(scheduler,/ScheduledAutoPostPermit/);
assert.match(scheduler,/platformMayPublish/);
assert.match(scheduler,/chooseNextMember/);
assert.match(scheduler,/uncertainPlatforms/);
assert.match(scheduler,/publishing_started_at/);
assert.doesNotMatch(scheduler,/getCurrentAppUserConnection\(/);
assert.doesNotMatch(scheduler,/\.filter\(\{ status: 'failed' \}/);
const gen=read('base44/functions/runSocialAutopilot/entry.ts');
assert.match(gen,/first_paid_subscription_at|paidPriorityAt/);
assert.match(gen,/campaignUrl/);
assert.match(gen,/ScheduledAutoPostPermit\.create/);
assert.match(gen,/readEntityPages/);
assert.match(gen,/social_last_generation_attempt_at/);
const official=read('base44/functions/runOfficialSocialPromotion/entry.ts');
assert.match(official,/ifund_facebook_business/);
assert.match(official,/platform-official/);
assert.match(official,/pending_approval/);
assert.doesNotMatch(official,/publishThroughConnection\(/);
for(const agent of ['chief_of_staff','communications_agent','story_agent','growth_agent','outreach_agent','finance_agent','strategy_agent','connection_discovery_agent','managed_connection_agent']) {
  const config=JSON.parse(read('base44/agents/'+agent+'.jsonc'));
  assert.ok(config.tool_configs.some(x=>x.function_name==='getWritingResearchBrief'),agent);
  assert.match(config.instructions,/WRITING|WRITING RESEARCH|WRITING AND MARKETING/);
}
const weekly=JSON.parse(read('base44/workflows/Weekly Writing Psychology & Social Trends Training.jsonc'));
assert.equal(weekly.trigger.config.cron_expression,'0 16 * * *');
assert.match(read('base44/functions/refreshWritingResearch/entry.ts'),/status: 'partial'/);
assert.match(read('base44/functions/refreshWritingResearch/entry.ts'),/reused: true/);
assert.match(read('base44/functions/refreshWritingResearch/entry.ts'),/6 \* 60 \* 60/);
const owned=JSON.parse(read('base44/workflows/IFund Official Social Editor.jsonc'));
assert.equal(owned.trigger.config.cron_expression,'0 */4 * * *');
assert.match(read('base44/functions/refreshWritingResearch/entry.ts'),/peer_reviewed/);
assert.match(read('base44/functions/refreshWritingResearch/entry.ts'),/sproutsocial.com/);
console.log('PASS social fairness, rolling window, official account separation, weekly research sources and agent instruction wiring');
