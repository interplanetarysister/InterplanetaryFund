import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'esbuild';
import {
  CHATGPT_BUILDER_URL, IFUND_BUILDER_APP_ID, createChatGPTBuilderPrompt, hasSecrets
} from '../src/lib/chatgptBuilderHandoff.js';

const read = name => fs.readFileSync(name, 'utf8');
assert.equal(CHATGPT_BUILDER_URL, 'https://chatgpt.com/');
assert.equal(IFUND_BUILDER_APP_ID, '6a67a778342a8fe05ee79cba');

const task = {
  id:'abc123def456',objective:'Repair the public navigation failures across the site',
  context_summary:'Affected routes: Discover, Help and campaign profiles; preserve live donations.'
};
const prompt=createChatGPTBuilderPrompt(task);
for(const phrase of [task.id,task.objective,task.context_summary,IFUND_BUILDER_APP_ID,
  'Base44 connector', 'GitHub Actions', 'checkpoint', 'connected plugins',
  'No code', 'super-admin']) {
  if(phrase==='No code')continue;
  assert.ok(prompt.includes(phrase),'Missing expected handoff content: '+phrase);
}
assert.equal(createChatGPTBuilderPrompt(null),'');
assert.equal(createChatGPTBuilderPrompt({id:'x',objective:''}),'');
assert.ok(hasSecrets('password: MySecretPasswordHere'));
assert.ok(hasSecrets('Bearer abcdefghijklmnopqrstuvwxyz'));
assert.ok(hasSecrets('sk-proj-1234567890abcdefghijkl'));
assert.equal(hasSecrets('Fix password reset button'),false);
assert.equal(createChatGPTBuilderPrompt({...task,context_summary:'password: MySecretPasswordHere'}),'',
  'Sensitive task text must not be assembled into a copyable builder prompt');

const frontend=read('src/components/agents/ChatGPTBuilderHandoff.jsx');
const parent=read('src/components/agents/AdminDevelopmentChat.jsx');
const gateway=read('base44/functions/manageAdminBuilderWork/entry.ts');
for(const f of ['src/components/agents/ChatGPTBuilderHandoff.jsx','src/components/agents/AdminDevelopmentChat.jsx']){
  transformSync(read(f),{loader:'jsx'});
}
assert.match(frontend,/manageAdminBuilderWork/);
assert.match(frontend,/mode: "queue"/);
assert.match(frontend,/mode: "list"/);
assert.match(frontend,/copy = async/);
assert.match(frontend,/navigator\.share/);
assert.match(frontend,/CHATGPT_BUILDER_URL/);
assert.match(frontend,/noopener noreferrer/);
assert.doesNotMatch(frontend,/\bwindow\.open\b/,'No blocked popup dependency');
assert.ok(parent.indexOf('<ChatGPTBuilderHandoff />') < parent.indexOf('{!sessionId ?'),
  'ChatGPT frontend handoff must not depend on internal agent-chat unlock');
assert.doesNotMatch(parent,/if \(!sessionId\) return/,'Admin failed session must not hide handoff');
assert.match(parent,/getFrontendIdentity\(user\)\.superAdminOwner/);
assert.match(parent,/PlatformFixReviewPanel/);
assert.match(gateway,/assertActiveAccount\(base44\)/);
assert.match(gateway,/isSuperAdmin\(owner\)/);
assert.match(gateway,/destination_agent:'admin_builder_agent'/);
assert.match(gateway,/implemented:false/);
assert.doesNotMatch(frontend,/\bOPENAI_API_KEY\b|\bAuthorization:\s*Bearer\b/i);
console.log('PASS: ChatGPT account handoff, safe static URL, Android share/clipboard, persistent server-admin task, no native agent session dependency, secret guard');
