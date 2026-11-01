import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const action = read("base44/functions/requestManagedConnectionAction/entry.ts");
const work = read("base44/functions/manageAgentWork/entry.ts");
const panel = read("src/components/connections/AgentWorkPanel.jsx");
const connectionPage = read("src/pages/Connections.jsx");
const agentPage = read("src/pages/Agents.jsx");
const agentMonitor = read("src/components/agents/AgentMonitor.jsx");
const social = read("src/components/social/PostComposer.jsx");
const knowledge = read("src/components/platform/KnowledgePanel.jsx");
const reports = read("src/components/analytics/ReportsPanel.jsx");
const conversation = read("src/components/agents/AgentChat.jsx");

assert.match(action, /verifyPlatformConnection/);
assert.doesNotMatch(action, /already_connected:\s*true/);
assert.match(action, /destination_agent: 'managed_connection_agent'/);
assert.match(action, /if \(active\)/);
assert.match(work, /owner_user_id: user\.id/);
assert.match(work, /if \(!hasManagedConnections\(user\) \|\| !hasUnifiedOboConsent\(user\)\)/);
assert.match(work, /work\.destination_agent !== 'managed_connection_agent'/);
assert.match(work, /connection\.created_by_id !== user\.id/);
assert.match(work, /verifyPlatformConnection/);
assert.match(work, /last_attempt_at/);
assert.match(panel, /mode: "advance"/);
assert.match(panel, /"waiting_external"/);
assert.match(panel, /slice\(0, 2\)/);
assert.match(connectionPage, /<AgentWorkPanel refreshKey=\{historyKey\}/);
assert.match(agentPage, /<AgentMonitor/);
assert.match(agentMonitor, /manageAgentWork/);
assert.match(agentMonitor, /trackAgentConversation/);
assert.match(social, /crosspost_platforms: \[\]/);
assert.match(social, /outcome\?\.post\?\.status === "published"/);
assert.match(social, /outcome\?\.manual === true/);
assert.match(social, /"Posted to IFund"/);
assert.match(knowledge, /response_json_schema: \{ type: "object", properties: \{ summary:/);
assert.match(knowledge, /finally \{\s*setSaving\(false\)/);
assert.match(reports, /finally \{\s*setGenerating\(false\)/);
assert.match(conversation, /trackAgentConversation/);
assert.match(conversation, /mode: "start"/);
assert.match(conversation, /mode: "sync"/);
assert.doesNotMatch(conversation, /outcome: "Message accepted; agent action not yet verified"/);
assert.match(conversation, /waiting_for_user_input/);

console.log("IFund AI action/connection status contracts verified.");
