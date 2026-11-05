import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("public Orbit Shorts route is not behind MemberAccess", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /path="\/shorts" element={<OrbitShorts \/>}/);
  assert.doesNotMatch(app, /path="\/shorts" element={<MemberAccess>/);
});
test("shorts preserve public campaign detail and social links", () => {
  const shorts = read("../src/pages/OrbitShorts.jsx");
  assert.match(shorts, /listActiveCampaigns/);
  assert.match(shorts, /ifund_posts/);
  assert.match(shorts, /encodeURIComponent\(campaign\.id\)/);
  assert.match(shorts, /prefers-reduced-motion/);
  assert.match(shorts, /ArrowDown/);
  assert.match(shorts, /playsInline/);
  assert.match(shorts, /muted={muted}/);
});
test("social feed offers video shorts discovery", () => {
  assert.match(read("../src/pages/SocialFeedPage.jsx"), /to="\/shorts"/);
});
