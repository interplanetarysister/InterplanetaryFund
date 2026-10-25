import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root='.agents/skills';
const legacy=['chief_of_staff','communications_agent','finance_agent','growth_agent','outreach_agent','story_agent','strategy_agent'];
const slug=name=>'ifund-'+name.replaceAll('_','-').replace(/-agent$/,'');
const read=p=>fs.readFileSync(p,'utf8');
const baseline=JSON.parse(read('scripts/fixtures/ifund-agent-access-baseline.json'));
const agents={};
for(const file of fs.readdirSync('base44/agents').filter(x=>x.endsWith('.jsonc'))){
  const agent=JSON.parse(read(path.join('base44/agents',file)));
  agents[agent.name]=agent;
}
assert.deepEqual(Object.keys(agents).sort(),Object.keys(baseline.agents).sort(),
 'Agent count/names changed during skill-only migration');
for(const [name,original] of Object.entries(baseline.agents)){
 const current=agents[name];
 assert.equal(name+'.jsonc',original.file);
 assert.deepEqual((current.tool_configs||[]).filter(x=>x.entity_name)
    .map(x=>({name:x.entity_name,operations:x.allowed_operations})),original.entity_access,
    'Entity permissions changed for '+name);
 const toolNames=(current.tool_configs||[]).filter(x=>x.function_name).map(x=>x.function_name);
 const expected=original.function_access.filter(x=>!(name==='outreach_agent' && x==='syncStripeSubscriptionCatalog'));
 assert.deepEqual(toolNames,expected,'Unexpected tool change for '+name);
 assert.deepEqual(current.selected_skill_names||[],original.selected_skill_names,
   'Managed skill selections changed for '+name);
 assert.deepEqual(current.selected_workspace_skill_ids||[],original.selected_workspace_skill_ids,
   'Workspace skill IDs changed for '+name);
 assert.deepEqual(current.allow_anonymous_access??null,original.anonymous,
   'Anonymous access changed for '+name);
 assert.deepEqual(current.memory_config??null,original.memory_config,
   'Memory access changed for '+name);
}

for(const role of legacy){
 const name=slug(role);
 const skill=path.join(root,name,'SKILL.md');
 assert.ok(fs.existsSync(skill),'Missing discovery skill '+skill);
 const text=read(skill);
 assert.match(text,new RegExp('^---\\r?\\nname: '+name+'\\r?\\ndescription: .+\\r?\\n---\\r?\\n'));
 assert.match(text,/Use this skill when|Use when/i,'Skill must describe when to trigger');
 const relative=path.join(root,name,'references','agent-guide.md');
 assert.ok(fs.existsSync(relative),'Missing reference '+relative);
 assert.equal(read(relative),read(path.join(root,role+'.md')),
   'Migrated reference diverged from existing legacy guide '+role);
 assert.ok(text.includes('references/agent-guide.md'),'SKILL.md must link directly to its reference');
}
for(const name of ['ifund-admin-builder','ifund-content-writes','wix-base44-connector']){
 const text=read(path.join(root,name,'SKILL.md'));
 assert.match(text,/^---\r?\n/,'Skill frontmatter must be the first line');
 assert.match(text,/\ndescription:/,'Skill metadata must include description');
}
assert.ok(fs.existsSync(path.join(root,'wix-base44-connector','utils.cjs')),
 'Preserve Wix helper at original runtime path');
assert.ok(!fs.existsSync(path.join(root,'wix-base44-connector','scripts','utils.cjs')),
 'Remove only redundant Wix helper after verifying all consumers');
assert.ok(fs.existsSync('base44/functions/syncStripeSubscriptionCatalog/entry.ts'),
 'Keep retired function stub for compatibility/history');
assert.ok(!fs.existsSync('base44/agent-skills'),
 'Do not create partial local in-app skill set: an implicit full-sync may delete uninspected remote skills');
assert.ok(fs.existsSync('docs/IFUND_AGENT_SKILLS_MIGRATION_2026-10-11.md'));
console.log('PASS: 10 agent permissions unchanged (one retired tool removed), 10 valid coding skill packages, 7 preserved legacy guides, Wix loader intact, no unsafe in-app skills sync');
