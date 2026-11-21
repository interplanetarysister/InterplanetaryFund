#!/usr/bin/env node
/**
 * Local, read-only Stitch design-reference capture for apps/web.
 *
 * This script follows Google's official `stitch::code-to-design` Strategy A:
 * build output -> local preview -> computed-style-resolved static HTML. It is
 * intentionally source-only: no application file is modified, no remote origin
 * is contacted, no authenticated action is attempted, and no Stitch upload is
 * performed. Authenticated screens are captured only in their public/guest
 * render state; their signed-in anatomy is documented in .stitch/references/.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, "../..");
const webDir = path.join(repoDir, "apps/web");
const distDir = path.join(webDir, "dist");
const outDir = path.join(repoDir, ".stitch");
const htmlDir = path.join(outDir, "html");
const shotDir = path.join(outDir, "screenshots");
const baseUrl = "http://127.0.0.1:4178";
const localBrowserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const targets = [
  {
    id: "homepage",
    label: "Public homepage / What If entry",
    route: "/",
    source: "apps/web/src/pages/Home.jsx",
    openAgent: false,
  },
  {
    id: "dashboard",
    label: "Member dashboard (guest render state)",
    route: "/dashboard",
    source: "apps/web/src/pages/Dashboard.jsx",
    openAgent: false,
    renderState: "Unauthenticated; account services unavailable, no private dashboard content rendered",
  },
  {
    id: "auth-voice",
    label: "Secure sign-in with NEXUS voice entry (guest render state)",
    route: "/login?returnTo=%2Fwhat-if",
    source: [
      "apps/web/src/pages/AuthPage.jsx",
      "apps/web/src/components/agents/GlobalAgentCompanion.jsx",
      "apps/web/src/components/agents/AgentSidePanel.jsx",
    ],
    openAgent: true,
    renderState: "Unauthenticated; secure sign-in form visible with advisory panel opened locally, no password or verification code entered",
  },
  {
    id: "what-if-support",
    label: "What If? private Mission with optional support selection",
    route: "/what-if",
    source: [
      "apps/web/src/pages/WhatIfStart.jsx",
      "apps/web/src/lib/supportNeeds.mjs",
    ],
    openAgent: false,
    requiredBuildVariable: "VITE_IFUND_WHAT_IF_ENABLED=enabled",
    interactions: [
      { type: "fill", selector: "#what-if-prompt", value: "I need help making reliable transportation possible for my family." },
      { type: "select", selector: "#what-if-support", value: "transport" },
    ],
    renderState: "Unauthenticated; local form text and noncash support choice only, no preview or save action",
  },
  {
    id: "campaign-creator",
    label: "Campaign creator (manual guest render state)",
    route: "/create?manual=1",
    source: "apps/web/src/pages/CreateCampaign.jsx",
    openAgent: false,
  },
  {
    id: "campaign-voice-artwork",
    label: "Campaign creator voice guide and original artwork choices",
    route: "/create?manual=1",
    source: [
      "apps/web/src/components/campaigns/CampaignVoiceGuide.jsx",
      "apps/web/src/components/campaigns/CampaignImageChoices.jsx",
      "apps/web/src/lib/supportNeeds.mjs",
    ],
    openAgent: false,
    interactions: [
      { type: "click", selector: '[aria-label="NEXUS spoken campaign walkthrough"] summary' },
      { type: "click", selector: '[aria-label="Generate optional iFund cover art"] summary' },
    ],
    renderState: "Unauthenticated manual entry; optional panels expanded by local clicks, no microphone, generation, upload, or draft save",
  },
  {
    id: "campaign-launch-eclipse",
    label: "Campaign creator launch review eclipse",
    route: "/create?manual=1",
    source: [
      "apps/web/src/pages/CreateCampaign.jsx",
      "apps/web/src/styles-cosmic-refinement.css",
      "apps/web/public/cosmic-eclipse.svg",
    ],
    openAgent: false,
    interactions: [
      { type: "click", selector: 'button:has-text("Continue")', repeat: 2, waitFor: ".ifund-eclipse-moment" },
    ],
    renderState: "Unauthenticated manual entry; wizard advanced locally to the review step, no draft saved or campaign published",
  },
  {
    id: "agent-team-overview",
    label: "AI Team overview (guest render state)",
    route: "/agents",
    source: "apps/web/src/pages/AgentsTeam.jsx",
    openAgent: false,
  },
  {
    id: "agent-chat",
    label: "Persistent agent chat panel (guest render state)",
    route: "/agents",
    source: [
      "apps/web/src/components/agents/GlobalAgentCompanion.jsx",
      "apps/web/src/components/agents/AgentSidePanel.jsx",
    ],
    openAgent: true,
  },
];

const viewports = [
  { id: "desktop", width: 1365, height: 900, label: "Desktop 1365x900" },
  { id: "mobile", width: 390, height: 844, label: "Mobile 390x844" },
];

const mimeByExt = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function findLocalBrowser() {
  for (const candidate of localBrowserCandidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function applyInteractions(page, interactions = []) {
  for (const interaction of interactions) {
    const locator = page.locator(interaction.selector).first();
    if (interaction.type === "fill") {
      await locator.fill(interaction.value);
    } else if (interaction.type === "select") {
      await locator.selectOption(interaction.value);
    } else if (interaction.type === "click") {
      const repeats = Number.isInteger(interaction.repeat) ? interaction.repeat : 1;
      for (let index = 0; index < repeats; index += 1) {
        await locator.click();
        await page.waitForTimeout(200);
      }
    } else {
      throw new Error(`Unsupported capture interaction: ${interaction.type}`);
    }
    if (interaction.waitFor) {
      await page.locator(interaction.waitFor).first().waitFor({ state: "visible", timeout: 10000 });
    }
  }
}

async function waitForPreview(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(baseUrl, { method: "GET" });
      if (res.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite preview did not become ready at ${baseUrl}`);
}

async function startPreview() {
  const viteBin = path.join(webDir, "node_modules/vite/bin/vite.js");
  const fallbackViteBin = path.join(repoDir, "node_modules/vite/bin/vite.js");
  const executable = (await exists(viteBin)) ? viteBin : fallbackViteBin;
  if (!(await exists(executable))) {
    throw new Error("Vite executable not found. Run `npm.cmd ci --no-audit --no-fund` first.");
  }
  const child = spawn(
    process.execPath,
    [executable, "preview", "--host", "127.0.0.1", "--port", "4178", "--strictPort"],
    { cwd: webDir, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  await waitForPreview().catch((error) => {
    child.kill("SIGTERM");
    throw new Error(`${error.message}\n${output}`);
  });
  return child;
}

async function inlineAssets(html) {
  const cache = new Map();
  async function dataUri(rawUrl) {
    const clean = decodeURIComponent(rawUrl.split("?")[0].split("#")[0]);
    if (cache.has(clean)) return cache.get(clean);
    if (!/^\/.*\.[a-z0-9]+$/i.test(clean)) return null;
    const publicPath = path.join(webDir, "public", clean.replace(/^\/+/, ""));
    const distPath = path.join(distDir, clean.replace(/^\/+/, ""));
    const file = (await exists(publicPath)) ? publicPath : (await exists(distPath)) ? distPath : null;
    if (!file) return null;
    const ext = path.extname(clean).toLowerCase();
    const mime = mimeByExt[ext];
    if (!mime) return null;
    const bytes = await readFile(file);
    const uri = `data:${mime};base64,${bytes.toString("base64")}`;
    cache.set(clean, uri);
    return uri;
  }

  let result = html;
  result = await replaceAsync(result, /url\((['"]?)(\/[^)'"]+)\1\)/g, async (match, _quote, url) => {
    const uri = await dataUri(url);
    return uri ? `url(${uri})` : match;
  });
  result = await replaceAsync(result, /(src|href)="(\/[^"]+)"/g, async (match, attr, url) => {
    const uri = await dataUri(url);
    return uri ? `${attr}="${uri}"` : match;
  });
  return result;
}

// Async String.replace support without modifying built-in prototypes.
async function replaceAsync(text, regex, replacer) {
  const matches = [...text.matchAll(regex)];
  let out = "";
  let last = 0;
  for (const match of matches) {
    out += text.slice(last, match.index);
    out += await replacer(match[0], ...match.slice(1), match);
    last = match.index + match[0].length;
  }
  return out + text.slice(last);
}

async function capture(page, target, viewport, manifest) {
  const errors = [];
  const blocked = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) {
      blocked.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    if (["http:", "https:"].includes(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) {
      blocked.push(url.href);
      return route.abort();
    }
    return route.continue();
  });

  await page.goto(baseUrl + target.route, { waitUntil: "load", timeout: 60000 });
  const expectedPath = new URL(target.route, baseUrl).pathname;
  const actualPath = new URL(page.url()).pathname;
  if (actualPath !== expectedPath) {
    throw new Error(`${target.id} redirected to ${actualPath}; required ${expectedPath}. Check the local build variables.`);
  }
  await applyInteractions(page, target.interactions);
  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
  });
  await page.waitForTimeout(1200);

  let panelOpened = "not-requested";
  if (target.openAgent) {
    try {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent("ifund-open-agent", { detail: { agent: "nexus" } }));
      });
      await page.locator(".ifund-agent-side-panel").waitFor({ state: "visible", timeout: 10000 });
      panelOpened = "visible";
    } catch (error) {
      panelOpened = `failed: ${String(error).slice(0, 180)}`;
    }
  }

  const extracted = await page.evaluate(() => {
    const styles = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        styles.push(Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"));
      } catch {
        // Cross-origin sheets are intentionally ignored in this local harness.
      }
    }
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("script").forEach((node) => node.remove());
    clone
      .querySelectorAll('link[rel="stylesheet"], link[rel="modulepreload"]')
      .forEach((node) => node.remove());
    const style = document.createElement("style");
    // Browser cssText serialization can add trailing spaces that git flags; normalize them.
    style.textContent = styles.join("\n").replace(/[ \t]+$/gm, "");
    clone.querySelector("head")?.appendChild(style);
    return {
      html: `<!doctype html>\n${clone.outerHTML}`,
      title: document.title,
      headings: Array.from(document.querySelectorAll("h1,h2,h3"))
        .map((node) => node.textContent.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 40),
      visibleText: (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4000),
    };
  });

  const id = `${target.id}-${viewport.id}`;
  const htmlPath = path.join(htmlDir, `${id}.html`);
  const shotPath = path.join(shotDir, `${id}.png`);
  await writeFile(htmlPath, await inlineAssets(extracted.html), "utf8");
  await page.screenshot({ path: shotPath, fullPage: false, animations: "disabled" });

  manifest.captures.push({
    id,
    label: `${target.label} — ${viewport.label}`,
    route: target.route,
    viewport: { width: viewport.width, height: viewport.height },
    source: target.source,
    requiredBuildVariable: target.requiredBuildVariable || null,
    interactions: target.interactions || [],
    title: extracted.title,
    headings: extracted.headings,
    visibleTextPreview: extracted.visibleText,
    panelOpened,
    html: path.relative(repoDir, htmlPath).replaceAll("\\", "/"),
    screenshot: path.relative(repoDir, shotPath).replaceAll("\\", "/"),
    consoleErrors: errors,
    blockedRequests: blocked.length,
    blockedRequestSample: blocked.slice(0, 8),
    renderState:
      target.renderState ||
      (target.openAgent
        ? "Unauthenticated; agent panel opened by local UI event, no question sent"
        : "Unauthenticated/public render state only"),
  });
  await page.close();
}

async function main() {
  if (!(await exists(distDir))) {
    throw new Error("apps/web/dist is missing. Run `npm.cmd run build` in apps/web first.");
  }
  await mkdir(htmlDir, { recursive: true });
  await mkdir(shotDir, { recursive: true });

  const localBrowser = await findLocalBrowser();
  const browserLabel = localBrowser
    ? `Local Chromium-compatible browser: ${localBrowser}`
    : "Playwright bundled Chromium";

  const manifest = {
    generatedAt: new Date().toISOString(),
    browser: browserLabel,
    generator: ".stitch/scripts/capture-references.mjs",
    strategy: "Google Stitch code-to-design Strategy A (local built app, computed styles resolved)",
    buildVariables: {
      VITE_IFUND_WHAT_IF_ENABLED: "enabled (local reference build only; not a release or production setting)",
    },
    constraints: [
      "Local Vite preview only; no hosted origin was contacted",
      "Read-only: all non-GET requests and all non-local HTTP(S) requests were aborted",
      "No authentication, member-agent action, payment, provider, or Stitch upload was performed",
      "Static HTML has scripts removed and same-origin CSS/images/fonts inlined as data URIs",
      "Local clicks only expanded optional panels or advanced the guest wizard; no draft or account mutation occurred",
    ],
    captures: [],
  };

  let preview;
  let browser;
  try {
    preview = await startPreview();
    browser = await chromium.launch({
      headless: true,
      ...(localBrowser ? { executablePath: localBrowser } : {}),
    });
    for (const target of targets) {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          colorScheme: "light",
          serviceWorkers: "block",
        });
        await capture(await context.newPage(), target, viewport, manifest);
        await context.close();
      }
    }
  } finally {
    if (browser) await browser.close();
    if (preview) preview.kill("SIGTERM");
  }

  await writeFile(
    path.join(outDir, "capture-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`Captured ${manifest.captures.length} references into ${path.relative(repoDir, outDir)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
