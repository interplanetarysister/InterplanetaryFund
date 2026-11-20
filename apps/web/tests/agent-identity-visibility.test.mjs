import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const panel = read("../src/components/agents/AgentSidePanel.jsx");
const history = read("../src/components/agents/TeamConversationHistory.jsx");
const team = read("../src/pages/AgentsTeam.jsx");
const launcher = read("../src/components/agents/AgentFeatureLauncher.jsx");
const specialist = read("../src/components/agents/SpecialistServiceWorkspace.jsx");
const editorial = read("../src/components/agents/EditorialAgentQueue.jsx");
const nexusBrief = read("../src/components/agents/NexusBrief.jsx");
const companion = read("../src/styles/agent-companion.css");

test("agent answers show the original icon for the responding identity", () => {
  assert.match(panel, /message\.kind === "answer"/);
  assert.match(panel, /<AgentIdentityIcon identity=\{message\.agent\}/);
});

test("shared team history shows icons for participating agents", () => {
  assert.match(history, /AgentIdentityIcon/);
  assert.match(history, /<AgentIdentityIcon identity=\{item\.agent_id\}/);
});

test("team recommendations show the target specialist icon", () => {
  assert.match(team, /<AgentIdentityIcon identity=\{recommendation\.target\}/);
  assert.match(team, /Proposed specialist calls:/);
});

test("campaign agent launcher shows each original agent icon", () => {
  assert.match(launcher, /AgentIdentityIcon/);
  assert.match(launcher, /<AgentIdentityIcon identity=\{agent\.identity\}/);
});

test("specialist workspaces show their original agent icons", () => {
  assert.match(specialist, /identity=\{growth \? "forge" : "polaris"\}/);
  assert.match(specialist, /identity="echo"/);
  assert.match(specialist, /identity="link"/);
});

test("editorial queue and NEXUS brief show original agent icons", () => {
  assert.match(editorial, /AgentIdentityIcon/);
  assert.match(nexusBrief, /<AgentIdentityIcon identity="nexus"/);
});

test("mobile agent panel manages focus, Escape and background scroll", () => {
  assert.match(panel, /max-width: 767px/);
  assert.match(panel, /aria-modal=\{compact \? "true" : undefined\}/);
  assert.match(panel, /event\.key === "Escape"/);
  assert.match(panel, /document\.body\.style\.overflow = "hidden"/);
  assert.match(panel, /previousFocus\.focus/);
  assert.match(companion, /ifund-agent-panel-choices button\s*\{[^}]*min-height:58px/);
  assert.match(companion, /ifund-agent-panel-close,\.ifund-agent-panel-tool,\.ifund-agent-panel-send/);
});

test("agent messaging changes remain advisory and do not add external actions", () => {
  assert.match(panel, /Keep browsing iFund while this advisory panel stays open\./);
  assert.match(team, /aria-label="Ask the iFund agent team"/);
  assert.match(panel, /Spoken words do not approve any action\./);
  assert.match(team, /This answer does not send messages, change campaigns, move money or publish content\./);
  assert.doesNotMatch(launcher, /fetch\(/);
  assert.doesNotMatch(editorial, /fetch\(/);
  assert.doesNotMatch(nexusBrief, /fetch\(/);
});
