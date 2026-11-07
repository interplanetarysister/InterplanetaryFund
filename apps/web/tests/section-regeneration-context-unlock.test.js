import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");

test("campaign context changes unlock obsolete section regeneration", () => {
  assert.match(source, /const regenerationRequest = useRef\(0\)/);
  assert.match(source, /const requestId = \+\+regenerationRequest\.current/);
  const invalidator = source.match(/function invalidateCampaignIdeas\(\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(invalidator);
  assert.match(invalidator, /regenerationRequest\.current \+= 1;\s*setRegeneratingSection\(-1\)/);
  assert.match(source, /if \(requestId === regenerationRequest\.current\) setRegeneratingSection\(-1\)/);
});
