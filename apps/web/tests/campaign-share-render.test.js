import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { loadComponent } from "./helpers/render.js";

// The share kit is a real React component, so this suite renders it instead of
// only pattern-matching its source.
const ID = "33333333-3333-4333-8333-333333333333";
let CampaignShareButton;
test.before(async () => {
  CampaignShareButton = (await loadComponent("src/components/campaigns/CampaignShareButton.jsx")).default;
});
const active = { id: ID, title: "Plaza lights", summary: "Light the plaza.", status: "active" };
const render = (campaign) => renderToStaticMarkup(createElement(CampaignShareButton, { campaign }));

test("the share kit renders for an active campaign and hides its panel by default", () => {
  const html = render(active);
  assert.match(html, /Help share this campaign!/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="campaign-share-panel"/);
  // The panel, and therefore the public link, is not in the collapsed markup.
  assert.doesNotMatch(html, /id="campaign-share-panel"/);
  assert.doesNotMatch(html, new RegExp(`/campaign/${ID}`));
  assert.doesNotMatch(html, /Copy link/);
});

test("the share kit renders nothing for a campaign that is not published", () => {
  for (const status of ["draft", "paused", undefined]) {
    assert.equal(render({ ...active, status }), "", `status ${String(status)} must not be shareable`);
  }
});

test("the share kit renders nothing without a usable campaign id", () => {
  assert.equal(render({ title: "x", status: "active" }), "");
});

test("the share kit renders without a browser navigator (no crash at mount)", () => {
  const html = render(active);
  assert.ok(html.length > 0);
  assert.doesNotMatch(html, /Share with your device/);
});
