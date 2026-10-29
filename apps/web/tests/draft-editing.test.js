import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
test("draft links reopen and update the owned draft",()=>{
 assert.match(source,/useSearchParams/);
 assert.match(source,/params\.get\("draft"\)/);
 assert.match(source,/\.eq\("owner_id",user\.id\)/);
 assert.match(source,/\.eq\("status","draft"\)/);
 assert.match(source,/\.update\(values\)/);
 assert.match(source,/\.insert\(\{ \.\.\.values, owner_id: user\.id \}\)/);
});
test("draft save never publishes or charges donors",()=>{
 assert.match(source,/status: "draft"/);
 assert.doesNotMatch(source,/status: "active"|paypal\.capture|stripe/);
});
