import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(path)=>fs.readFileSync(path,'utf8');
const configs=fs.readdirSync('base44/agents').filter(n=>n.endsWith('.jsonc'))
  .map(file=>JSON.parse(read('base44/agents/'+file)));
const visible=configs.filter(a=>a.name!=='admin_builder_agent');
assert.equal(visible.length,9);
for(const agent of visible){
  const funcs=(agent.tool_configs||[]).map(x=>x.function_name);
  assert.ok(funcs.includes('routeAgentTask'),agent.name+' missing specialist dispatch');
  assert.ok(!funcs.includes('ownerAgentChatActions'),agent.name+' must not approve directly');
  assert.ok(!funcs.includes('applyAgentContentDraft'),agent.name+' must not apply directly');
}
const owner=read('base44/functions/ownerAgentChatActions/entry.ts');
for(const literal of ['assertActiveAccount','owner_chat_authorized','owner_instruction',
  'AgentContentDraft.filter({owner_user_id:user.id}',"status==='draft'",
  "publishPost","confirm_owner_review:true","manageBlog",
  'published','approved_manual','unconfirmed']){
  assert.ok(owner.includes(literal),'Missing owner approval guard/step: '+literal);
}
assert.ok(owner.includes('user_publish_authorized:true'),'Missing explicit signed-in owner publish intent');
assert.ok(!configs.some(a=>a.tool_configs?.some(t=>t.function_name==='ownerAgentChatActions')));
const route=read('base44/functions/routeAgentTask/entry.ts');
for(const literal of ['assertActiveAccount','hasSubscriptionLevel','hasManagedConnections',
  'Campaign.get(campaignId)','created_by_id!==user.id','SPECIALISTS',
  'base44.agents.createConversation','base44.agents.addMessage',
  'owner_user_id:user.id','mode===\'status\'',"status:'in_progress'",
  'completed_at','needs_review']){
  assert.ok(route.includes(literal),'Missing specialist dispatch guarantee: '+literal);
}
assert.ok(route.includes("if(!SPECIALISTS[capability]"),'Capabilities must be allowlisted');
assert.ok(!route.includes("admin_builder_agent',"),'Admin builder must not be a specialist target');
const ui=read('src/components/agents/AgentChat.jsx');
assert.ok(ui.includes('OWNER_APPROVAL.test(content)'));
assert.ok(ui.includes('ownerAgentChatActions'));
assert.ok(ui.includes('DRAFT_LOOKUP.test(content)'));
assert.ok(ui.includes('agentContent'));
const monitor=read('src/components/agents/AgentMonitor.jsx');
assert.ok(monitor.includes('routeAgentTask'));
assert.ok(monitor.includes('delegation_id: task.id'));
console.log('PASS: owner-only agent chat approvals, genuine specialist handoffs, scope and status source checks');
console.log('SOURCE ONLY: runtime authorization, real provider posts and deployment still require owner staging checks.');
