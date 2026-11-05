#!/usr/bin/env node
// Read-only release smoke gate. This does not establish visual or functional parity.
// Usage: node scripts/verify-preview-http.mjs https://<deployment>.pages.dev
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
const paths = ["/", "/discover", "/create-campaign"];
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
      /<script\b[^>]*src=/i.test(body) &&
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
// Verify actual referenced entry assets, not merely an HTML shell that mentions them.
const assetRefs = [...shell.matchAll(/<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
  .map(match => ({ tag: match[1].toLowerCase(), url: match[2] }))
  .filter(asset => asset.tag === "script" || /\.css(?:[?#]|$)/i.test(asset.url));
if (!assetRefs.some(asset => asset.tag === "script") ||
    !assetRefs.some(asset => /\.css(?:[?#]|$)/i.test(asset.url))) {
  failed = true;
  console.error("FAIL entry assets: expected JavaScript and CSS references in HTML shell");
}
let checkedLocalJs = 0;
let checkedLocalCss = 0;
for (const asset of assetRefs) {
  try {
    const url = new URL(asset.url, base);
    if (url.origin !== base.origin) continue; // External SDKs are checked in browser acceptance.
    if (url.pathname.endsWith(".js") || url.pathname.endsWith(".mjs")) checkedLocalJs++;
    if (/\.css$/i.test(url.pathname)) checkedLocalCss++;
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const type = (response.headers.get("content-type") || "").toLowerCase();
    const isCss = /\.css(?:[?#]|$)/i.test(url.pathname);
    const valid = response.status === 200 && (isCss ? type.includes("text/css") :
      /javascript|ecmascript/.test(type));
    if (!valid) failed = true;
    console.log(`${valid ? "PASS" : "FAIL"} asset ${url.pathname}: HTTP ${response.status}; content-type=${type}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL asset ${asset.url}: ${error.message}`);
  }
}
if (!checkedLocalJs || !checkedLocalCss) {
  failed = true;
  console.error("FAIL entry assets: no same-origin JavaScript and CSS bundle pair found");
}
if (failed) {
  console.error("Preview HTTP smoke gate FAILED. Do not promote to production.");
  process.exit(1);
}
console.log("Preview HTTP smoke gate passed. Still requires visual parity, authenticated flows, Base44 connectivity, and rollback verification.");
