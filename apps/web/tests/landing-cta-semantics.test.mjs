import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Prevent invalid nested interactive controls in the public conversion paths.
const sources=["../src/pages/Home.jsx","../src/pages/About.jsx"];
for(const source of sources){
  test(source+" uses single interactive anchors for styled internal CTAs",()=>{
    const code=readFileSync(new URL(source,import.meta.url),"utf8");
    assert.doesNotMatch(code,/<Link\b[^>]*>\s*<Button\b/s,
      "React Router Link must not contain an interactive button");
    assert.doesNotMatch(code,/<Button\b(?![^>]*\basChild)[^>]*>\s*<Link\b/s,
      "Button wrapping a Link must use asChild");
    assert.match(code,/<Button asChild/);
  });
}

test("public CTAs still navigate directly to campaigns and discovery",()=>{
  const home=readFileSync(new URL(sources[0],import.meta.url),"utf8");
  for(const path of ["/create","/discover","/dashboard"])
    assert.match(home,new RegExp('to="'+path+'"'));
});
