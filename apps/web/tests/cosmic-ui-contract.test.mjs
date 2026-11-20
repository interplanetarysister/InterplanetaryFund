import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../src/styles/ifund-next-cosmic.css");
const entry = read("../src/main.jsx");
const button = read("../src/components/ui/button.jsx");
const dashboard = read("../src/pages/Dashboard.jsx");

test("cosmic layer is scoped, readable and motion-aware", () => {
  assert.match(css, /\.ifund-stage/);
  assert.match(css, /\.ifund-public/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /ifund-dashboard-module/);
  assert.match(css, /ifund-dashboard-stat/);
  assert.match(css, /button\[data-loading="true"\]::before/);
  // The unapproved Printful/merchant provider work is deliberately not part of this layer.
  assert.doesNotMatch(css, /ifund-merch|Printful/i);
});

test("web entry loads the cosmic layer after the base stylesheet", () => {
  assert.match(entry, /@\/index\.css";\s*\nimport "@\/styles\/ifund-next-cosmic\.css";/);
});

test("shared Button exposes an accessible loading state", () => {
  assert.match(button, /LoaderCircle/);
  assert.match(button, /loading = false/);
  assert.match(button, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(button, /disabled=\{asChild \? undefined : isDisabled\}/);
  assert.match(button, /asChild \? children/);
});

test("dashboard cosmic upgrade preserves template, sponsor, agent and guest surfaces", () => {
  assert.match(dashboard, /ifund-dashboard-stat/);
  assert.match(dashboard, /ifund-dashboard-module/);
  assert.match(dashboard, /PromptComposer/);
  assert.match(dashboard, /\/fund-your-mission/);
  assert.match(dashboard, /AGENT_WORKSPACES/);
  assert.match(dashboard, /AgentIdentityIcon/);
  assert.match(dashboard, /FollowFeed/);
  assert.match(dashboard, /EventsDashboardSection/);
  assert.match(dashboard, /state === "guest"/);
});
