import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchesStoredConnection, CONNECTION_PROVIDER_ALIASES } from "../src/lib/connectionCatalog.mjs";
const ui=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");

test("LINK recognizes existing provider aliases rather than showing false disconnected state",()=>{
 assert.deepEqual(CONNECTION_PROVIDER_ALIASES.facebook_pages,["facebook_pages","facebook"]);
 assert.deepEqual(CONNECTION_PROVIDER_ALIASES.instagram,["instagram","instagram_business"]);
 assert.equal(matchesStoredConnection({provider:"facebook"},"facebook_pages"),true);
 assert.equal(matchesStoredConnection({provider:"instagram_business"},"instagram"),true);
 assert.equal(matchesStoredConnection({provider:"youtube_channel"},"youtube"),true);
 assert.equal(matchesStoredConnection({provider:"twitter"},"x"),true);
 assert.equal(matchesStoredConnection({provider:"unknown"},"x"),false);
 assert.match(ui,/matchesStoredConnection\(row,selectedOAuth\)/);
});
test("LINK never counts a connected record as active until verification has a timestamp",()=>{
 assert.match(ui,/row\.status==="connected" && Boolean\(row\.verified_at\)/);
 assert.match(ui,/Finish connecting/);
 assert.match(ui,/providerReady\[selectedOAuth\]===true/);
});
