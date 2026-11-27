import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_WORKSPACES } from "../src/lib/agentWorkspaces.mjs";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
const cards = read("../src/pages/AgentsTeam.jsx");
const identities = read("../src/components/agents/AgentIdentityIcon.jsx");
const contract = JSON.parse(read("../../../worker/services/position-contracts.json"));

test("nine specialist roles plus the REACH front desk remain, with backends consolidated on the member board", () => {
  assert.equal(AGENT_WORKSPACES.length, 10);
  assert.equal(new Set(AGENT_WORKSPACES.map(a=>a.service)).size, 10);
  assert.equal(new Set(AGENT_WORKSPACES.map(a=>a.identity)).size, 10);
  assert.ok(!AGENT_WORKSPACES.some(a=>a.service==="admin_builder_agent"));
  const publicRoles=AGENT_WORKSPACES.filter(a=>!a.consolidatedInto);
  assert.equal(publicRoles.length,5);
  assert.deepEqual(publicRoles.map(a=>a.identity).sort(), ["nexus","orbit","polaris","reach","story"]);
  assert.equal(AGENT_WORKSPACES.find(a=>a.identity==="discover")?.consolidatedInto,"link");
  for (const backend of ["echo","pulse","link","forge"]) {
    assert.equal(AGENT_WORKSPACES.find(a=>a.identity===backend)?.consolidatedInto,"reach");
  }
  assert.match(cards,/filter\(agent => !agent\.consolidatedInto\)/);
  for (const workspace of AGENT_WORKSPACES) {
    assert.match(workspace.service,/^[a-z_]+$/);
    assert.match(workspace.path,/^\/[a-z-]+$/);
    assert.ok(workspace.evidence.length>35);
  }
});

test("Story opens existing authenticated AI workspace instead of fake specialist chat", () => {
  assert.match(cards, /selected === "story"/);
  assert.match(cards, /setShowWriting\(true\)/);
  assert.match(cards, /<StoryAgent[^>]*initialCampaignId=\{selection\.campaignId\}/);
  assert.match(cards, /Selecting this role does not send a message/);
});

test("misleading 'builder' and 'financial growth' member labels are corrected", () => {
  assert.match(identities, /orbit: \{ name: "ORBIT", role: "Finance"/);
  assert.match(identities, /forge: \{ name: "FORGE", role: "Growth"/);
  assert.match(identities, /story: \{ name: "STORY", role: "Campaign Writing"/);
  assert.match(identities, /discover: \{ name: "DISCOVER", role: "Connection Discovery"/);
});
