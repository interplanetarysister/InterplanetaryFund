import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("What If enabled: both Start a Mission links use the prompt-first route", () => {
  const dashboard = source("../src/pages/Dashboard.jsx");
  const layout = source("../src/components/Layout.jsx");
  const app = source("../src/App.jsx");
  assert.match(dashboard, /to=\{whatIfEnabled \? "\/what-if" : "\/create"\}/);
  assert.match(dashboard, /to=\{whatIfEnabled \? "\/register\?returnTo=%2Fwhat-if" : "\/register\?returnTo=%2Fcreate"\}/);
  assert.match(layout, /to: WHAT_IF_LAUNCHED \? "\/what-if" : "\/create"/);
  assert.match(app, /path="\/what-if" element=\{WHAT_IF_ENABLED \? <WhatIfStart\/>/);
});

test("manual and draft campaign editor routes are preserved", () => {
  const app = source("../src/App.jsx");
  assert.match(app, /path="\/create" element=\{<CreateCampaign \/>\}/);
  assert.match(app, /path="\/campaigns\/:id\/edit"/);
  assert.match(app, /path="\/missions\/:id"/);
});
