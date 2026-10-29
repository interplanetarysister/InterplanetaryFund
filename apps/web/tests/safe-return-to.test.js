import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../src/lib/safeReturnTo.js";

test("legitimate IFund route survives sign-in",()=>{
 assert.equal(safeReturnTo("/agents"),"/agents");
 assert.equal(safeReturnTo("/profile?tab=account"),"/profile?tab=account");
});
test("external and recursive authentication redirects are rejected",()=>{
 assert.equal(safeReturnTo("https://evil.test"),"/dashboard");
 assert.equal(safeReturnTo("//evil.test"),"/dashboard");
 assert.equal(safeReturnTo("/%2F%2Fevil.test"),"/dashboard");
 assert.equal(safeReturnTo("/login"),"/dashboard");
});
