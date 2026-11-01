import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/TermsAcceptance.jsx", import.meta.url), "utf8");
test("anonymous public routes bypass the account Terms overlay without bypassing protected routes", () => {
  for (const route of ["/discover", "/social", "/community", "/blogs", "/globe", "/download", "/founding-members", "/activate"])
    assert.ok(source.includes('"' + route + '"'), route);
  for (const prefix of ["/campaign/", "/blogs/", "/publications/", "/u/", "/community/"])
    assert.ok(source.includes('"' + prefix + '"'), prefix);
  const publicSet = source.match(/const PUBLIC_BROWSE_ROUTES=new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(publicSet);
  for (const protectedRoute of ["/dashboard", "/create", "/profile", "/connections", "/admin", "/giving", "/devices"])
    assert.doesNotMatch(publicSet[1], new RegExp('"' + protectedRoute + '"'));
  assert.match(source, /PUBLIC_BROWSE_PREFIXES\.some\(prefix=>pathname\.startsWith\(prefix\)\)/);
});
test("blocked lifecycle accounts receive a terminal accessible denial rather than a perpetual spinner", () => {
  assert.match(source, /if\(phase==="blocked"\)return <div role="alert"/);
  assert.match(source, /Account access unavailable/);
  assert.match(source, /Visit the public Help Center/);
  assert.match(source, /if\(exempt \|\| phase==="ready"&&!user\)return children/);
});
