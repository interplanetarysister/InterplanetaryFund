import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/components/ScrollToTop.jsx",import.meta.url),"utf8");

test("route changes reset page scroll without unsupported instant-only animation",()=>{
  assert.match(source,/scrollToStart\(\)/);
  assert.match(source,/behavior: "auto"/);
  assert.match(source,/document\.querySelector\("\[data-page-scroll\]"\)/);
  assert.doesNotMatch(source,/behavior: "instant"/);
});
test("hash navigation respects reduced motion and avoids retaining stale scroll",()=>{
  assert.match(source,/getHashId\(hash\)/);
  assert.match(source,/decodeURIComponent/);
  assert.match(source,/prefers-reduced-motion: reduce/);
  assert.match(source,/target\.scrollIntoView/);
  assert.match(source,/else scrollToStart\(\)/);
  assert.match(source,/window\.clearTimeout\(timer\)/);
});
