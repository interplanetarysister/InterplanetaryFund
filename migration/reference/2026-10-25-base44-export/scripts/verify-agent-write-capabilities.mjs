import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const parse=(p)=>JSON.parse(read(p));
const dir='base44/agents/';
const agents=fs.readdirSync(dir).filter(f=>f.endsWith('.jsonc')).map(f=>parse(dir+f));
const names=agents.map(a=>a.name);
assert.equal(new Set(names).size,names.length);
const builder=agents.find(a=>a.name==='admin_builder_agent');
assert.ok(builder,'missing private admin role');
assert.equal(builder.allow_anonymous_access,false);
assert.deepEqual(builder.tool_configs.map(t=>t.function_name).sort(),['manageAdminBuilderWork','managePlatformIncidents'].sort());
for(const a of agents){
  const funcs=(a.tool_configs||[]).map(t=>t.function_name).filter(Boolean);
  assert.ok(!funcs.includes('applyAgentContentDraft'),a.name+' must not apply drafts');
  if(a.name!=='admin_builder_agent'){
    assert.ok(!funcs.includes('manageAdminBuilderWork'),a.name+' must not access builder');
    assert.ok(!funcs.includes('managePlatformIncidents'),a.name+' must not approve platform repair plans');
    assert.ok(!(a.selected_skill_names||[]).includes('adminagent'),a.name+' has legacy builder skill');
    assert.ok(funcs.includes('getAgentAccountContext'),a.name+' needs current account view');
  }
}
const drafts=['chief_of_staff','strategy_agent','growth_agent','communications_agent','story_agent','outreach_agent'];
for(const name of drafts){
  const a=agents.find(a=>a.name===name);
  assert.ok(a.tool_configs.some(t=>t.function_name==='manageAgentContentDraft'),name+' needs draft tool');
}
for(const path of [
  'base44/entities/AgentContentDraft.jsonc',
  'base44/functions/getAgentAccountContext/entry.ts',
  'base44/functions/manageAgentContentDraft/entry.ts',
  'base44/functions/applyAgentContentDraft/entry.ts',
  'base44/functions/manageAdminBuilderWork/entry.ts',
  '.agents/skills/ifund-content-writes/SKILL.md',
  '.agents/skills/ifund-admin-builder/SKILL.md',
  'src/components/agents/AgentContentReview.jsx',
]) assert.ok(fs.existsSync(path),'missing '+path);
const gate=read('base44/functions/manageAdminBuilderWork/entry.ts');
assert.match(gate,/isSuperAdmin\(owner\)/);
assert.match(gate,/user\?\.role==='admin'/);
assert.match(read('base44/functions/executeAdminAgentRequest/entry.ts'),/admin_builder_agent/);
assert.match(read('src/components/agents/AdminDevelopmentChat.jsx'),/admin_builder_agent/);
assert.ok(!read('src/pages/Agents.jsx').includes('name: "admin_builder_agent"'),'admin builder must not appear in normal agent list');
const applying=read('base44/functions/applyAgentContentDraft/entry.ts');
assert.match(applying,/confirm_owner_review!==true/);
assert.match(applying,/cross_post:false/);
assert.match(applying,/owner_user_id!==user.id/);
assert.match(applying,/status:'applying'/);
assert.match(read('src/components/agents/AgentContentReview.jsx'),/checked={!!confirmed\[d.id\]}/);
const schema=parse('base44/entities/AgentContentDraft.jsonc');
assert.equal(schema.rls.create['data.owner_user_id'],'{{user.id}}');
assert.equal(schema.rls.update['data.owner_user_id'],'{{user.id}}');
console.log('PASS: '+agents.length+' agent configs; owner-only content review and server-gated admin-builder source contracts');
console.log('SOURCE ONLY: test does not prove deployed Base44 agent tools or live publishing');
