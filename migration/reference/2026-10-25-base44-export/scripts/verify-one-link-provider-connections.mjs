import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const connections = read("src/pages/Connections.jsx");
const dialog = read("src/components/connections/ConnectDialog.jsx");
const provider = read("base44/functions/getAppUserConnector/entry.ts");
const finalize = read("base44/functions/finalizeAppUserOAuthConnection/entry.ts");

assert.match(connections, /params\.get\("connect"\)/);
assert.match(connections, /ALL_PLATFORMS\.find\(\(item\) => item\.id === requested\)/);
// Deep links open the selected provider dialog, but OAuth must require a direct user action.
assert.match(connections, /setDialog\(\{ platform, existing \}\)/);
assert.doesNotMatch(connections, /quickConnect: platform\.setupKind === "oauth"/);
assert.match(connections, /useLocation\(\)/);
assert.match(connections, /navigate\(\{ pathname: "\/connections"/);
assert.match(dialog, /oauthAttemptBlocked/);
assert.match(dialog, /connectAppUser\(data\.connector_id\)/);
assert.match(dialog, /connectors\.connectAppUser\(data\.connector_id\)/);
assert.match(dialog, /window\.location\.assign\(providerAuthorizationDestination\(/);
assert.match(dialog, /destination\.protocol !== "https:"/);
assert.match(dialog, /No post will be sent/);
assert.doesNotMatch(dialog, /publishInitial:/);
assert.doesNotMatch(connections, /functions\.invoke\("publishLinkedCampaignToConnection"/);
assert.match(connections, /verifyPlatformConnection/);
assert.match(provider, /registration_reference_present/);
assert.match(provider, /readiness: 'not_configured'/);
assert.match(finalize, /requested_capabilities: selectedCapabilities/);
assert.match(finalize, /provider_capabilities: confirmed/);
assert.match(finalize, /status: 'disconnected'/);
for (const name of ["chief_of_staff", "managed_connection_agent", "connection_discovery_agent"]) {
  const agent = JSON.parse(read("base44/agents/" + name + ".jsonc"));
  assert.match(agent.instructions, /\/connections\?connect=/);
  assert.match(agent.instructions, /provider/i);
}
console.log("IFund one-link provider authorization and explicit-publishing safety: PASS");
