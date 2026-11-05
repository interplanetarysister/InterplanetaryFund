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
      !base.hostname.endsWith(".pages.dev") || base.pathname !== "/" ||
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
      /<html[\\s>]/i.test(body) &&
      /<script\\b[^>]*src=/i.test(body) &&
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
if (failed) {
  console.error("Preview HTTP smoke gate FAILED. Do not promote to production.");
  process.exit(1);
}
console.log("Preview HTTP smoke gate passed. Still requires visual parity, authenticated flows, Base44 connectivity, and rollback verification.");
