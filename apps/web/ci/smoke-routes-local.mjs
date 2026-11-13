#!/usr/bin/env node
/**
 * Canonical iFund source-only browser smoke.
 *
 * This check does not certify authenticated workflows, RLS, payments,
 * external OAuth, AI-provider calls, or preview/production readiness.
 * It runs against a local Vite server with publishable Supabase settings.
 * Playwright is a manual QA dependency, not a required build dependency.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.IFUND_PLAYWRIGHT_MODULE || "playwright");
const root = new URL("../", import.meta.url);
const routes = JSON.parse(readFileSync(new URL("ci/route-acceptance.json", root), "utf8")).routes;
const hostname = "127.0.0.1";
const port = Number(process.env.IFUND_SMOKE_PORT || 4291);
const origin = `http://${hostname}:${port}`;
const widths = [320, 390, 768, 1280];
const errors = [];
const results = [];
const validDummy = "00000000-0000-4000-8000-000000000001";

function candidate(route) {
  if (route === "*") return "/this-route-does-not-exist";
  return route.replaceAll(":id", validDummy)
    .replaceAll(":slug", "getting-started")
    .replaceAll(":provider", "google");
}
function assertPublicConfig() {
  const url = String(process.env.VITE_SUPABASE_URL || "");
  const key = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  if (url !== "https://ssibsfmtodgximseeqsv.supabase.co" ||
      !key.startsWith("sb_publishable_")) {
    throw Error("Use the verified canonical Supabase URL and a browser-safe publishable key.");
  }
}
async function waitForServer(child) {
  for (let attempt=0;attempt<50;attempt++) {
    if (child.exitCode !== null) throw Error("Vite exited before browser check.");
    try { const response = await fetch(origin); if (response.ok) return; }
    catch { /* Vite still booting */ }
    await delay(250);
  }
  throw Error("Local Vite server did not become ready.");
}
async function checkRoutes(browser, width, records) {
  const context = await browser.newContext({
    viewport: { width, height: 850 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  for (const record of records) {
    const path = candidate(record.route);
    const pageErrors = [];
    const serverErrors = [];
    const onError = error => pageErrors.push(String(error.message).slice(0,180));
    const onResponse = response => {
      if (response.url().startsWith(origin) && response.status() >= 500) {
        serverErrors.push(response.status() + " " + new URL(response.url()).pathname);
      }
    };
    page.on("pageerror", onError);
    page.on("response", onResponse);
    let status = 0, text = "", overflow = null;
    try {
      const response = await page.goto(origin + path, {
        waitUntil: "domcontentloaded", timeout: 15000,
      });
      status = response?.status() || 0;
      // Lazy pages and remote auth initialization vary by device; do not
      // misclassify a transitional Suspense skeleton as an empty route.
      await page.waitForFunction(() => document.body?.innerText?.length >= 45,
        null, { timeout: 5000 }).catch(() => {});
      text = await page.locator("body").innerText();
      overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - window.innerWidth);
    } catch (error) {
      pageErrors.push(String(error.message).slice(0,180));
    }
    const expectedCompactEmbed = record.route === "/embed/campaign/:id";
    const rejected =
      status !== 200 ||
      pageErrors.length > 0 ||
      serverErrors.length > 0 ||
      text.includes("Coming soon on the new platform") ||
      (!expectedCompactEmbed && text.length < 50) ||
      (overflow !== null && overflow > 10) ||
      // A guest must not read a protected workspace in an unauthenticated pass.
      (record.role !== "public" && !text.includes("Register an email account to create content"));
    const result = { route: record.route, width, status,
      chars: text.length, overflow, pageErrors, serverErrors, rejected };
    results.push(result);
    if (rejected) errors.push(result);
    page.off("pageerror", onError);
    page.off("response", onResponse);
  }
  await context.close();
}

async function main() {
  assertPublicConfig();
  const vite = spawn(process.execPath,
    ["./node_modules/vite/bin/vite.js", "--host", hostname,
      "--port", String(port), "--strictPort"],
    { cwd: root.pathname, env: process.env, stdio: "ignore" });
  let browser;
  try {
    await waitForServer(vite);
    browser = await chromium.launch({
      headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    // Exercise EVERY tracked route at EVERY viewport. Splitting routes into
    // viewport buckets hid mobile-only failures on three quarters of routes.
    // Run sequentially to bound local browser/network resource consumption.
    for (const width of widths) {
      await checkRoutes(browser, width, routes);
    }
    const summary = {
      total: results.length, passed: results.length - errors.length,
      failed: errors.length, screenWidths: widths,
      notes: "Source-only guest render, no authenticated or provider acceptance",
    };
    process.stdout.write(JSON.stringify({ summary, failures: errors }, null, 2) + "\n");
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser?.close();
    vite.kill("SIGTERM");
  }
}
main().catch(error => {
  process.stderr.write("iFund browser smoke failed: " + error.message + "\n");
  process.exitCode = 1;
});
