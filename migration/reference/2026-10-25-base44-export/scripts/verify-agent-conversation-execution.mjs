import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync('base44/functions/trackAgentConversation/entry.ts', 'utf8');
const start = source.indexOf('function inspectAgentResponse(');
const end = source.indexOf('\nexport default async function', start);
assert.ok(start > -1 && end > start);
const code = ts.transpileModule(source.slice(start, end) +
  '\nexport { inspectAgentResponse };', {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { inspectAgentResponse } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);

const check = (messages, status, old = []) => {
  const result = inspectAgentResponse({ messages }, old);
  assert.equal(result.status, status);
  assert.equal(typeof result.result, 'string');
  assert.doesNotMatch(result.result, /Bearer |access_token|secret=/i);
};
check([], 'responding');
check([{ id: 'old', role: 'assistant', content: 'Old reply' }], 'responding', ['old']);
check([{ id: 'reply-1', role: 'assistant', content: 'I prepared a draft.' }], 'responded');
check([{ id: 'reply-2', role: 'assistant', content: 'Working', tool_calls: [{ status: 'running' }] }], 'responding');
check([{ id: 'reply-3', role: 'assistant', content: 'Needs approval', tool_calls: [{ status: 'waiting_for_user_input' }] }], 'waiting_user');
check([{ id: 'reply-4', role: 'assistant', content: 'Tool failed', tool_calls: [{ status: 'error' }] }], 'tool_failed');
check([{ id: 'reply-5', role: 'assistant', content: '' }], 'responding');

const schema = JSON.parse(fs.readFileSync('base44/entities/AgentConversationRun.jsonc', 'utf8'));
assert.equal(schema.rls.read['data.owner_user_id'], '{{user.id}}');
assert.deepEqual(schema.rls.create, { user_condition: { role: 'admin' } });
assert.ok(schema.properties.status.enum.includes('delivery_unconfirmed'));
assert.match(source, /visible.owner_user_id !== user.id/);
assert.match(source, /base44.agents.getConversation\(conversationId\)/);
assert.match(source, /baseline_assistant_ids: baseline/);
assert.match(source, /External operations require separate verification/);
const chat = fs.readFileSync('src/components/agents/AgentChat.jsx', 'utf8');
assert.match(chat, /mode: "start"/);
assert.match(chat, /mode: "sync"/);
assert.match(chat, /getConversation\(conversationId\)/);
const social = fs.readFileSync('base44/shared/socialPublish.ts', 'utf8');
assert.doesNotMatch(social, /getConnection\('linkedin'\)/);
assert.match(social, /ownerOAuth\?\.accessToken/);
const cron = fs.readFileSync('base44/functions/syncConnections/entry.ts', 'utf8');
assert.match(cron, /canAutoPublish\(connection\)/);
assert.match(cron, /ScheduledAutoPostPermit/);
assert.match(cron, /platformMayPublish/);
assert.doesNotMatch(cron, /getCurrentAppUserConnection\(/);
const manual = fs.readFileSync('base44/functions/publishPost/entry.ts', 'utf8');
assert.match(manual, /getCurrentAppUserConnection\(connectorId\)/);
assert.match(manual, /publishThroughConnection\(connection, text, sr, ownerOAuth\)/);
const interactions = fs.readFileSync('base44/functions/recordAgentInteraction/entry.ts', 'utf8');
assert.match(interactions, /status: 'pending'/);
assert.match(interactions, /externally_executed: false/);
assert.doesNotMatch(interactions, /body.approved === true \? 'approved'/);
const mission = fs.readFileSync('src/components/mission/AutomationPanel.jsx', 'utf8');
assert.match(mission, /trackAgentConversation/);
assert.match(mission, /finally \{\s*setLoading\(false\)/);
console.log('Agent request progression, owner isolation, and OAuth publishing isolation passed.');
