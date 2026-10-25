import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Deterministic source audit, not a live capability assertion.
 * Designed for a zero-credit build lane: never launches an agent, remote
 * browser, provider login, or billable external API.
 */
const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const config=JSON.parse(read('package.json'));
const agents=fs.readdirSync('base44/agents').filter(file=>file.endsWith('.jsonc'));
const declaredFunctions=new Set(fs.readdirSync('base44/functions').filter(file=>fs.existsSync(path.join(root,'base44/functions',file,'entry.ts')) || fs.existsSync(path.join(root,'base44/functions',file,'entry.js'))));
const declaredEntities=new Set(fs.readdirSync('base44/entities').filter(file=>file.endsWith('.jsonc')).map(file=>file.replace(/\.jsonc$/,'')));
const issues=[];
let declaredToolCount=0;
let skillRefs=0;
for (const file of agents){
  const agent=JSON.parse(read('base44/agents/'+file));
  assert.equal(agent.name,path.basename(file,'.jsonc'),'Agent name and filename must agree');
  for (const tool of agent.tool_configs || []) {
    declaredToolCount++;
    if (tool.function_name && !declaredFunctions.has(tool.function_name)) issues.push(file+': function '+tool.function_name+' has no backend entry');
    if (tool.entity_name && !declaredEntities.has(tool.entity_name)) issues.push(file+': entity '+tool.entity_name+' has no schema');
  }
  skillRefs+=(agent.selected_skill_names || []).length+(agent.selected_workspace_skill_ids||[]).length;
  // Skill references are not proof the workspace has authorized them.
}
const browser=read('base44/functions/runBrowserConnection/entry.ts');
const workerConfig=read('wrangler.toml');
const browserEnabled=!/browser_execution_deferred/.test(browser);
const cloudflareBrowserBinding=/^\s*\[browser\]\s*$/m.test(workerConfig);
const playwrightInstalled=Boolean(config.devDependencies?.playwright||config.dependencies?.playwright);
assert.ok(agents.length>=9,'Expected specialist team');
assert.ok(playwrightInstalled,'Playwright browser checks must be declared in development dependencies');
assert.equal(issues.length,0,issues.join('\n'));
console.log('PASS: '+agents.length+' agent files, '+declaredToolCount+' declared backend tools are referenced in source.');
console.log('SOURCE-ONLY: '+skillRefs+' skill references; workspace installation/permission remains UNVERIFIED until checked in running agent session.');
console.log('PLAYWRIGHT LOCAL: package declared; executable and shared-libraries availability must be checked in each new build sandbox.');
console.log('BROWSER CONNECTION: '+(browserEnabled?'implementation present, live validation still required':'DEFERRED by runBrowserConnection; no live browser runs'));
console.log('CLOUDFLARE BROWSER BINDING: '+(cloudflareBrowserBinding?'declared, permission/quotas still unverified':'NOT CONFIGURED in main gateway'));
console.log('BACKEND AUTHORITY: Base44 functions/entities/auth/agents remain active; static Worker or webpage publishing cannot independently migrate them.');
if(!browserEnabled || !cloudflareBrowserBinding) console.log('ACTION: deploy a separate authenticated browser-runner with verified quotas, approved URL policy, credentials isolation and provider permission; do not put Chromium in user app.');
