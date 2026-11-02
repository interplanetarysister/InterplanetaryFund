import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { loadComponent } from "./helpers/render.js";

// A card's link target is user-facing navigation, so it is rendered for real
// rather than pattern-matched in the source.
const ID = "33333333-3333-4333-8333-333333333333";
let CampaignCard;
test.before(async () => {
  CampaignCard = (await loadComponent("src/components/campaigns/CampaignCard.jsx")).default;
});
const render = (campaign) => renderToStaticMarkup(
  createElement(MemoryRouter, null, createElement(CampaignCard, { campaign })));

test("an active campaign links to its public page", () => {
  const html = render({ id: ID, title: "Plaza lights", status: "active" });
  assert.ok(html.includes(`href="/campaign/${ID}"`), html.slice(0, 300));
});

test("a draft campaign links back into the editor", () => {
  const html = render({ id: ID, title: "Plaza lights", status: "draft" });
  assert.ok(html.includes(`href="/create?draft=${ID}"`));
  assert.match(html, /Private draft/);
});

test("a paused campaign links to owner management, never the public page", () => {
  const html = render({ id: ID, title: "Plaza lights", status: "paused" });
  // The public detail page only serves active campaigns, so this must not be a
  // dead public link.
  assert.ok(!html.includes(`href="/campaign/${ID}"`), "paused card must not link to the public page");
  assert.ok(html.includes('href="/campaigns"'));
  assert.match(html, /Hidden from Discover/);
});

test("a card without funding totals does not invent zeros", () => {
  const html = render({ id: ID, title: "Plaza lights", status: "active", summary: "Light it." });
  assert.match(html, /Light it\./);
  assert.doesNotMatch(html, /\$0/);
  assert.doesNotMatch(html, /0 donors/);
});
