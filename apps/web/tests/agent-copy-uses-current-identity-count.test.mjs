import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("agent source comments do not claim the obsolete seven-identity team", () => {
  const board = read("../src/pages/AgentsTeam.jsx");
  const layout = read("../src/components/Layout.jsx");
  const identities = read("../src/components/agents/AgentIdentityIcon.jsx");

  assert.doesNotMatch(board, /seven[- ](?:agent|specialist)/i);
  assert.doesNotMatch(layout, /seven[- ](?:agent|specialist)/i);
  assert.match(identities, /nexus:[\s\S]*discover:/);
  assert.match(board, /registered specialist[\s*]+identities/);
});

test("visible agent copy describes advisory questions, not persistent chat", () => {
  const board = read("../src/pages/AgentsTeam.jsx");
  const panel = read("../src/components/agents/AgentSidePanel.jsx");

  assert.match(board, /ask an advisory question in a panel that stays open/);
  assert.match(board, /Choose an agent to ask an advisory question in a side panel/);
  assert.doesNotMatch(board, /open a conversation that stays visible/);
  assert.doesNotMatch(board, /chat in a side panel/);

  assert.match(panel, /aria-label="Agent advisory panel"/);
  assert.match(panel, /this advisory panel stays open/);
  assert.match(panel, /aria-label=\{"Ask " \+ AGENT_IDENTITIES\[id\]\.name\}/);
  assert.doesNotMatch(panel, /aria-label="Agent conversation"/);
  assert.doesNotMatch(panel, /Talk to " \+/);
});
