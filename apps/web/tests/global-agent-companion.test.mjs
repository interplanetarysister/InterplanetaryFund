import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("one persistent agent panel spans both public and member routes",()=>{
 const app=read("../src/App.jsx");
 const layout=read("../src/components/Layout.jsx");
 const dock=read("../src/components/agents/GlobalAgentCompanion.jsx");
 const panel=read("../src/components/agents/AgentSidePanel.jsx");
 assert.match(app,/<GlobalAgentCompanion><AppRoutes \/><\/GlobalAgentCompanion>/);
 assert.match(dock,/ifund-open-agent/);
 assert.match(dock,/Ask IFund/);
 assert.match(dock,/<AgentSidePanel/);
 assert.doesNotMatch(layout,/<AgentSidePanel/);
 assert.match(panel,/\/api\/agents\/team\/status/);
 assert.match(panel,/ifund_story_subscription/);
 assert.match(panel,/canAskAgentWithSavedPermission/);
});
test("free site navigation remains available without bypassing AI authorization",()=>{
 const panel=read("../src/components/agents/AgentSidePanel.jsx");
 const css=read("../src/styles/agent-companion.css");
 assert.match(panel,/aria-label="Quick site navigation"/);
 assert.match(panel,/to="\/help"/);
 assert.match(panel,/to="\/create\?manual=1"/);
 assert.match(panel,/to="\/discover"/);
 assert.match(css,/ifund-global-agent-launcher:focus-visible/);
 assert.match(css,/max-width:767px/);
});
