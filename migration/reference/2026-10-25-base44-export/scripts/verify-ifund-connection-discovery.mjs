import assert from 'node:assert/strict';
import fs from 'node:fs';
const text=(path)=>fs.readFileSync(path,'utf8');
const discovery=text('base44/functions/discoverConnectionMethods/entry.ts');
const owner=text('base44/functions/manageOwnerConnectionConfiguration/entry.ts');
const managed=JSON.parse(text('base44/agents/managed_connection_agent.jsonc'));
const chief=JSON.parse(text('base44/agents/chief_of_staff.jsonc'));
for(const [feature,body,needle] of [
 ['authentication',discovery,'assertActiveAccount'],
 ['platform owner enforcement',discovery,'OWNER_EMAILS.has(clean(user.email))'],
 ['provider methods not verified',discovery,'connection_verified:false'],
 ['provider policy not verified',discovery,'provider_policy_verified:false'],
 ['browser runner not claimed',discovery,'not enabled by this endpoint'],
 ['owner-only authentication',owner,'OWNER_EMAILS.has(clean(user.email))'],
 ['request status owner isolation',owner,'pending.owner_user_id !== user.id'],
 ['one-time approval claim',owner,"status:'applying',approved_at:claimedAt"],
 ['recipe conditional update',owner,'PlatformConnectionRecipe.updateMany({'],
 ['provider route candidate checks',owner,'blocked_routes?.includes(transport)']
]) assert.ok(body.includes(needle),'Missing '+feature);
for(const agent of [managed,chief])assert.ok(agent.tool_configs.some(x=>x.function_name==='discoverConnectionMethods'),'Discovery not exposed to agent');
assert.ok(!discovery.includes('accessToken')&&!discovery.includes('cookies')&&!discovery.includes('secret_value'),'Sensitive values exposed by discovery');
console.log('Static IFund connection integration checks passed');
