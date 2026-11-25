import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = relative => readFileSync(new URL(relative, import.meta.url), "utf8");
const nav = source("../src/components/communications/PublishingWorkflowNav.jsx");
const styles = source("../src/styles-publishing-workflow.css");
const agents = source("../src/pages/AgentsTeam.jsx");
const messages = source("../src/pages/CommunicationsWorkspace.jsx");
const artwork = source("../src/pages/AIImageStudio.jsx");
const connections = source("../src/pages/ManagePermissions.jsx");
const routes = source("../src/App.jsx");

test("five publishing steps use only existing route destinations and one in-page approvals section", () => {
  for (const label of ["AI Team", "Messages", "Artwork", "Review & approvals", "Connections"])
    assert.ok(nav.includes('title: "' + label + '"'), label);
  for (const path of ["/agents", "/communications", "/ai-images", "/connections"])
    assert.ok(routes.includes('path="' + path + '"'), path);
  assert.match(nav, /\/communications#reviewed-delivery/);
  assert.doesNotMatch(routes, /path="\/approvals"/);
});

test("all connected destinations share the same navigation", () => {
  for (const page of [agents, messages, artwork, connections])
    assert.match(page, /<PublishingWorkflowNav/);
  assert.match(nav, /styles-publishing-workflow\.css/);
  assert.match(messages, /id="reviewed-delivery"/);
  assert.match(messages, /scrollIntoView/);
  assert.match(nav, /aria-current=/);
});

test("publishing remains consent- and ownership-gated", () => {
  assert.match(messages, /campaignFromOwnedList/);
  assert.match(messages, /EchoApprovedMessaging/);
  assert.match(messages, /run|Prepare local draft/);
  assert.match(connections, /Connecting an account does not give iFund permission to publish/);
  assert.match(nav, /never authorize publishing/);
  assert.doesNotMatch(nav, /fetch\(|\.rpc\(/);
});

test("mobile controls and motion are accessible", () => {
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(messages, /ifund-feedback-loading/);
  assert.match(artwork, /ifund-feedback-error/);
});
