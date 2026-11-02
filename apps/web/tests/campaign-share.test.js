import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANONICAL_ORIGIN, campaignShareUrl, campaignShareText, shareTargets,
  buildSharePayload, canUseWebShare,
} from "../src/lib/campaignShare.js";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ID = "33333333-3333-4333-8333-333333333333";
const campaign = (over = {}) => ({
  id: ID, title: "Plaza lights", summary: "Light the plaza.", status: "active", ...over,
});

test("a share link is canonical and only built for a real campaign id", () => {
  assert.equal(campaignShareUrl(ID), `${CANONICAL_ORIGIN}/campaign/${ID}`);
  assert.equal(campaignShareUrl(ID.toUpperCase()), `${CANONICAL_ORIGIN}/campaign/${ID}`);
  for (const bad of ["", null, undefined, "not-a-uuid", "123", "../../etc/passwd", "1 OR 1=1"]) {
    assert.equal(campaignShareUrl(bad), "", `rejects ${String(bad)}`);
  }
});

test("a preview or hostile origin cannot be shared as the canonical link", () => {
  // A non-http(s) or unparseable origin must fall back to the canonical domain.
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "not a url", ""]) {
    assert.equal(campaignShareUrl(ID, bad), `${CANONICAL_ORIGIN}/campaign/${ID}`);
  }
  assert.equal(campaignShareUrl(ID, "https://preview.example.dev"), `https://preview.example.dev/campaign/${ID}`);
});

test("share text falls back gracefully and never emits undefined", () => {
  assert.equal(campaignShareText(campaign()), "Plaza lights — Light the plaza.");
  assert.equal(campaignShareText({ title: "Solo" }), "Solo");
  assert.equal(campaignShareText({}), "an Interplanetary Fund campaign");
  assert.equal(campaignShareText({ title: "  ", summary: "  " }), "an Interplanetary Fund campaign");
});

test("every share target encodes its dynamic values", () => {
  const tricky = campaign({ title: 'R&D "cause" & more', summary: "50% off? yes/no" });
  const url = campaignShareUrl(ID);
  const targets = shareTargets(tricky, url);
  assert.equal(targets.length, 4);
  for (const target of targets) {
    // Raw delimiters must not survive into the query string.
    assert.doesNotMatch(target.href, /[^\s]*"[^\s]*=[^&]/, `${target.id} leaked a quote`);
    assert.ok(!target.href.includes("&more"), `${target.id} leaked an unencoded ampersand`);
    assert.ok(!target.href.includes("% off"), `${target.id} leaked an unencoded percent`);
  }
  const x = targets.find((t) => t.id === "x");
  assert.match(x.href, /^https:\/\/twitter\.com\/intent\/tweet\?text=/);
  assert.ok(x.href.includes(encodeURIComponent(url)));
  const email = targets.find((t) => t.id === "email");
  assert.match(email.href, /^mailto:\?subject=/);
  assert.ok(email.href.includes(encodeURIComponent("R&D \"cause\" & more")));
});

test("share targets are empty without a link and long text is clamped", () => {
  assert.deepEqual(shareTargets(campaign(), ""), []);
  const long = campaign({ title: "T".repeat(500), summary: "S".repeat(500) });
  const x = shareTargets(long, campaignShareUrl(ID)).find((t) => t.id === "x");
  const text = new URLSearchParams(x.href.split("?")[1]).get("text");
  assert.ok(text.length <= 200, `clamped text was ${text.length} chars`);
});

test("the web share payload and capability check are well formed", () => {
  assert.deepEqual(buildSharePayload(campaign(), campaignShareUrl(ID)), {
    title: "Plaza lights", text: "Plaza lights — Light the plaza.", url: campaignShareUrl(ID),
  });
  assert.equal(canUseWebShare(undefined), false);
  assert.equal(canUseWebShare({}), false);
  assert.equal(canUseWebShare({ share() {} }), true);
});

test("the share button is public, published-only, and honest about failures", () => {
  const button = source("src/components/campaigns/CampaignShareButton.jsx");
  // Anonymous visitors can share, so it must not require authClient.
  assert.doesNotMatch(button, /authClient|auth\.getUser/);
  assert.match(button, /campaign\?\.status !== "active"/);
  assert.match(button, /rel=\{target\.id === "email" \? undefined : "noopener noreferrer"\}/);
  // A denied clipboard must never report success.
  assert.match(button, /Copying is unavailable in this browser/);
});

test("CampaignDetail renders the share kit for visitors", () => {
  const page = source("src/pages/CampaignDetail.jsx");
  assert.match(page, /import CampaignShareButton from "@\/components\/campaigns\/CampaignShareButton"/);
  assert.match(page, /<CampaignShareButton campaign=\{campaign\} \/>/);
  assert.doesNotMatch(page, /share kit, supporter list/);
});
