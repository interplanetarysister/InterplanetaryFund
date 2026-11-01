import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(name, 'utf8');
const routes = read('src/App.jsx');
const connections = read('src/pages/Connections.jsx');
const dialog = read('src/components/connections/ConnectDialog.jsx');
const returnTo = read('src/lib/authReturnTo.js');

assert.match(routes, /path="\/connections" element=\{<Connections \/>\}/, 'Canonical Connections route must exist');
assert.match(routes, /pathname \+ search \+ hash/, 'Sign-in must remember query-based provider links and help section hashes');
assert.match(returnTo, /url\.pathname \+ url\.search \+ url\.hash/, 'Login return must retain connection-help hash');
assert.match(connections, /useLocation\(\)/, 'Connection route must listen for SPA navigation');
assert.match(connections, /new URLSearchParams\(location\.search\)/, 'Deep-link params must be read from the active route');
assert.match(connections, /params\.get\("connect"\)/);
assert.match(connections, /params\.get\("platform"\)/);
assert.match(connections, /params\.get\("provider"\)/);
assert.match(connections, /ALL_PLATFORMS\.find\(\(item\) => item\.id === requested\)/, 'Only known providers may initiate connections');
assert.match(connections, /navigate\(\{ pathname: "\/connections"/, 'Router must consume provider link to prevent loops');
assert.doesNotMatch(connections, /window\.history\.replaceState\(/, 'Direct history mutation desynchronizes route changes');
assert.match(dialog, /base44\.connectors\.connectAppUser\(data\.connector_id\)/, 'Provider login links must be generated per-user on click');
assert.doesNotMatch(connections, /functions\.invoke\("publishLinkedCampaignToConnection"/, 'Connection links must not publish content');

for (const f of [
 'src/components/Layout.jsx',
 'src/components/agents/AgentChat.jsx',
 'src/components/distribution/DistributionPanel.jsx',
 'src/components/campaigns/CrossPlatformTotals.jsx',
 'src/components/social/ShareToProfileDialog.jsx',
 'src/pages/Profile.jsx',
 'src/pages/Social.jsx',
 'src/components/admin/AdminApprovalQueue.jsx',
]) assert.match(read(f), /\/connections/, f+' must use the canonical Connections path');

const help = read('src/pages/Help.jsx');
assert.match(help, /\/connections#connection-help/);
assert.match(help, /\/login\?returnTo=%2Fconnections%23connection-help/);

for (const agent of ['chief_of_staff', 'managed_connection_agent', 'connection_discovery_agent']) {
 const instructions = JSON.parse(read('base44/agents/'+agent+'.jsonc')).instructions;
 assert.match(instructions, /\/connections\?connect=PLATFORM_ID/);
}
console.log('PASS: Connections route, sign-in return, Help link, agent links, per-provider deep links, and no auto-post');
