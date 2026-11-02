import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANONICAL_ORIGIN, campaignShareUrl, campaignShareText, shareTargets,
  buildSharePayload, canUseWebShare, campaignEmbedUrl, campaignEmbedSnippet,
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

test("the embed URL is canonical and refuses a non-UUID id", () => {
  assert.equal(campaignEmbedUrl(ID), `${CANONICAL_ORIGIN}/embed/campaign/${ID}`);
  assert.equal(campaignEmbedUrl(ID.toUpperCase()), `${CANONICAL_ORIGIN}/embed/campaign/${ID}`);
  for (const bad of ["", "not-a-uuid", null, undefined, 12, `${ID}x`]) {
    assert.equal(campaignEmbedUrl(bad), "", `must reject ${JSON.stringify(bad)}`);
  }
});

test("the embed URL never trusts a hostile or preview origin", () => {
  // An embed pasted on someone else's site must point at the branded domain, so
  // a preview or attacker-controlled origin can never become the canonical src.
  assert.equal(campaignEmbedUrl(ID, "http://localhost:4599"), `http://localhost:4599/embed/campaign/${ID}`);
  assert.equal(campaignEmbedUrl(ID, "javascript:alert(1)"), `${CANONICAL_ORIGIN}/embed/campaign/${ID}`);
  assert.equal(campaignEmbedUrl(ID, "not a url"), `${CANONICAL_ORIGIN}/embed/campaign/${ID}`);
});

test("the embed snippet is an inert iframe with no script and no privileged attributes", () => {
  const snippet = campaignEmbedSnippet({ id: ID, title: "Plaza lights" });
  assert.match(snippet, /^<iframe /);
  assert.match(snippet, new RegExp(`src="${CANONICAL_ORIGIN}/embed/campaign/${ID}"`));
  assert.match(snippet, /loading="lazy"/);
  assert.match(snippet, /referrerpolicy="no-referrer"/);
  // No script, no event handlers, no allow-scripts sandbox escape.
  assert.doesNotMatch(snippet, /<script|onload=|onerror=|javascript:|allow-scripts/i);
  assert.doesNotMatch(snippet, /allowfullscreen/);
  // Exactly one well-formed, closed iframe element.
  assert.equal((snippet.match(/<iframe/g) || []).length, 1);
  assert.match(snippet, /<\/iframe>$/);
});

test("a campaign title cannot break out of the embed markup", () => {
  const snippet = campaignEmbedSnippet({
    id: ID, title: 'x"><script>alert(1)</script>',
  });
  assert.doesNotMatch(snippet, /<script/);
  assert.doesNotMatch(snippet, /"><script/);
  assert.match(snippet, /&lt;script&gt;/);
  assert.match(snippet, /&quot;&gt;/);
  // The attribute stays balanced: exactly the two quotes of the title attribute
  // are added, none from the payload.
  assert.equal((snippet.match(/title="/g) || []).length, 1);
});

test("the embed snippet falls back to a safe default title and refuses a bad id", () => {
  assert.match(campaignEmbedSnippet({ id: ID }), /title="Interplanetary Fund campaign"/);
  assert.equal(campaignEmbedSnippet({ title: "x" }), "");
});

test("the share button exposes the embed code without a script tag", () => {
  const button = source("src/components/campaigns/CampaignShareButton.jsx");
  assert.match(button, /campaignEmbedSnippet/);
  assert.match(button, /id="campaign-embed-code"/);
  assert.match(button, /Copy embed code/);
  // A blocked clipboard must not be reported as a successful copy.
  assert.match(button, /Select the embed code and copy it manually/);
});

test("the owner dashboard shares active campaigns in place", () => {
  const page = source("src/pages/MyCampaigns.jsx");
  assert.match(page, /import CampaignShareButton from "@\/components\/campaigns\/CampaignShareButton"/);
  // Only an active row gets the kit: drafts and paused campaigns have no public page.
  assert.match(page, /campaign\.status === "active" && \(\s*<div className="mt-4">\s*<CampaignShareButton campaign=\{campaign\} \/>/);
});
