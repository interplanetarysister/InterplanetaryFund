import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");
test("LINK manages recognized connection aliases instead of showing false disconnected state",()=>{
 assert.match(ui,/facebook_pages: \["facebook_pages", "facebook"\]/);
 assert.match(ui,/instagram: \["instagram", "instagram_business"\]/);
 assert.match(ui,/const aliases = ALIASES\[provider\.id\] \|\| \[provider\.id\]/);
 assert.match(ui,/\(ALIASES\[provider\.id\] \|\| \[provider\.id\]\)\.includes\(row\.provider\)/);
});
test("LINK never treats merely connected records as verified without timestamps",()=>{
 assert.match(ui,/row\.status === "connected" && row\.verified_at/);
 assert.match(ui,/Provider setup pending/);
 assert.match(ui,/providerReady\[provider\.id\] === true/);
});
