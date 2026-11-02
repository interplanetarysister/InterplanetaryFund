import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

// The share kit is a real React component, so this suite renders it instead of
// only pattern-matching its source. esbuild is already a build dependency, so
// no new tooling is introduced.
const webRoot = fileURLToPath(new URL("../", import.meta.url));
const cacheDir = path.join(webRoot, "node_modules", ".cache", "ifund-render-tests");
const ID = "33333333-3333-4333-8333-333333333333";

let CampaignShareButton;

test.before(async () => {
  mkdirSync(cacheDir, { recursive: true });
  const outfile = path.join(cacheDir, "CampaignShareButton.mjs");
  await build({
    entryPoints: [path.join(webRoot, "src/components/campaigns/CampaignShareButton.jsx")],
    outfile,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    platform: "neutral",
    alias: { "@": path.join(webRoot, "src") },
    // React stays external so the renderer and the component share one instance.
    external: ["react", "react-dom", "react/jsx-runtime"],
    logLevel: "silent",
  });
  CampaignShareButton = (await import(pathToFileURL(outfile).href)).default;
});

test.after(() => { rmSync(cacheDir, { recursive: true, force: true }); });

const active = { id: ID, title: "Plaza lights", summary: "Light the plaza.", status: "active" };

test("the share kit renders for an active campaign and hides its panel by default", () => {
  const html = renderToStaticMarkup(createElement(CampaignShareButton, { campaign: active }));
  assert.match(html, /Share this campaign/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="campaign-share-panel"/);
  // The panel, and therefore the public link, is not in the collapsed markup.
  assert.doesNotMatch(html, /id="campaign-share-panel"/);
  assert.doesNotMatch(html, new RegExp(`/campaign/${ID}`));
  assert.doesNotMatch(html, /Copy link/);
});

test("the share kit renders nothing for a campaign that is not published", () => {
  for (const status of ["draft", "paused", undefined]) {
    const html = renderToStaticMarkup(createElement(CampaignShareButton, { campaign: { ...active, status } }));
    assert.equal(html, "", `status ${String(status)} must not be shareable`);
  }
});

test("the share kit renders nothing without a usable campaign id", () => {
  const html = renderToStaticMarkup(createElement(CampaignShareButton, { campaign: { title: "x", status: "active" } }));
  assert.equal(html, "");
});

test("the share kit renders without a browser navigator (no crash at mount)", () => {
  // renderToStaticMarkup has no window/navigator; mounting must still succeed.
  const html = renderToStaticMarkup(createElement(CampaignShareButton, { campaign: active }));
  assert.ok(html.length > 0);
  assert.doesNotMatch(html, /Share with your device/);
});
