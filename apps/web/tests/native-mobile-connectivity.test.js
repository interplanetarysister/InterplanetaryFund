import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("mobile-only connection banner does not alter website UI", () => {
  const banner = read("../src/components/native/NativeConnectivityBanner.jsx");
  const main = read("../src/main.jsx");
  assert.match(banner, /const native = isNativeBundle\(\)/);
  assert.match(banner, /if \(!native \|\| !\["offline", "unavailable"\]\.includes\(status\)\) return null/);
  assert.match(main, /<NativeConnectivityBanner\s*\/>/);
});

test("mobile offline state does not claim that backend or payments are current", () => {
  const banner = read("../src/components/native/NativeConnectivityBanner.jsx");
  assert.match(banner, /window\.addEventListener\("offline"/);
  assert.match(banner, /window\.addEventListener\("online"/);
  assert.match(banner, /fetch\("\/api\/health"/);
  assert.match(banner, /cache: "no-store"/);
  assert.match(banner, /response\.ok \? "unknown" : "unavailable"/);
  assert.match(banner, /Changes and payments cannot be confirmed/);
  assert.doesNotMatch(banner, /localStorage|indexedDB|serviceWorker|cache\.put\(/);
});

test("mobile offline banner has actionable keyboard-accessible retry", () => {
  const banner = read("../src/components/native/NativeConnectivityBanner.jsx");
  assert.match(banner, /aria-live="polite"/);
  assert.match(banner, /role="status"/);
  assert.match(banner, /<button type="button" onClick=\{checkConnection\}/);
  assert.match(banner, /min-h-11/);
  assert.match(banner, /focus-visible:outline/);
});
