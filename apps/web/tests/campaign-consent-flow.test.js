import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/pages/CreateCampaign.jsx", import.meta.url), "utf8");
test("guest can draft while signed-in organizers see legal consent gate", () => {
  assert.match(source, /return ownerId \? <MemberAccess>\{composer\}<\/MemberAccess> : composer/);
  assert.match(source, /restoreBrowserCampaign\(sessionStorage, ownerId\)/);
  assert.match(source, /rememberBrowserCampaign\(sessionStorage, ownerId, form\)/);
});
test("campaign publishing requires verified server response", () => {
  assert.match(source, /await saveOwnerCampaign\(client, form,/);
  assert.match(source, /if \(status === "active"\) navigate/);
});
