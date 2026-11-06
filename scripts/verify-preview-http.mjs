#!/usr/bin/env node
// Read-only release smoke gate. This does not establish visual or functional parity.
// Usage: node scripts/verify-preview-http.mjs https://<deployment>.pages.dev
import { extractEntryAssets } from './architecture/verify-preview-entry-assets.mjs';

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/verify-preview-http.mjs https://<deployment>.pages.dev");
  process.exit(2);
}
let base;
try {
  base = new URL(input);
  if (base.protocol !== "https:" || base.username || base.password ||
      !(base.hostname === "interplanetaryfund-migration.pages.dev" ||
        base.hostname.endsWith(".interplanetaryfund-migration.pages.dev")) ||
      base.port || base.pathname !== "/" ||
      base.search || base.hash) throw new Error("expected HTTPS Cloudflare Pages preview origin");
} catch (error) {
  console.error("Invalid preview URL:", error.message);
  process.exit(2);
}
// The original Base44 frontend uses /create; keep the migration alias too until parity is verified.
const paths = ["/", "/discover", "/create", "/create-campaign"];
let failed = false;
let shell = "";
for (const path of paths) {
  try {
    const response = await fetch(new URL(path, base), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "text/html" }
    });
    const type = response.headers.get("content-type") || "";
    const body = await response.text();
    const valid = response.status === 200 &&
      type.toLowerCase().includes("text/html") &&
      /<html[\s>]/i.test(body) &&
      /<script\b[^>]*\bsrc\s*=\s*["\x27][^"\x27]+["\x27]/i.test(body) &&
      /interplanetary|ifund/i.test(body);
    if (!valid) failed = true;
    if (path === "/") shell = body;
    const sameShell = path === "/" || body === shell;
    if (!sameShell) failed = true;
    console.log(`${valid && sameShell ? "PASS" : "FAIL"} ${path}: HTTP ${response.status}; content-type=${type}; SPA shell=${sameShell}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path}: ${error.message}`);
  }
}
// Reuse the independently tested entry parser: reject commented-out tags,
// external entrypoints, and HTML that lacks a real same-origin JS/CSS pair.
let assetRefs = [];
try {
  const entries = extractEntryAssets(shell, base.href);
  assetRefs = [...entries.scripts, ...entries.styles];
} catch (error) {
  failed = true;
  console.error(`FAIL entry assets: ${error.message}`);
}
for (const asset of assetRefs) {
  try {
    const url = new URL(asset);
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const type = (response.headers.get("content-type") || "").toLowerCase();
    const isCss = /\\.css$/i.test(url.pathname);
    const valid = response.status === 200 && (isCss ? type.includes("text/css") :
      /javascript|ecmascript/.test(type));
    if (!valid) failed = true;
    console.log(`${valid ? "PASS" : "FAIL"} asset ${url.pathname}: HTTP ${response.status}; content-type=${type}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL asset ${asset}: ${error.message}`);
  }
}
if (failed) {
  console.error("Preview HTTP smoke gate FAILED. Do not promote to production.");
  process.exit(1);
}
console.log("Preview HTTP smoke gate passed. Still requires visual parity, authenticated flows, Base44 connectivity, and rollback verification.");
