import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");

test("LINK presents connected/available summaries above a selected platform's context",()=>{
 assert.match(source,/Actively connected platforms/);
 assert.match(source,/Available to connect/);
 assert.match(source,/selectedProvider===provider\.id/);
 assert.match(source,/PROVIDERS\.filter\(provider => provider\.id === selectedProvider\)/);
 assert.match(source,/aria-pressed=\{selectedProvider===provider\.id\}/);
 assert.match(source,/setSelectedProvider\(provider\.id\)/);
});

test("connection status and publishing permission remain independent, without exposing developer configuration",()=>{
 assert.match(source,/connectionCapabilityReadiness\(\{record:row,authorizationEnabled:ready\}\)/);
 assert.match(source,/does not authorize campaign sharing/);
 assert.match(source,/iFund does not assume that connecting an account authorizes sharing or marketing/);
 assert.doesNotMatch(source,/description: "[^"]*(?:developer-app|per-user OAuth|API access)/i);
 assert.match(source,/providerReady\[provider\.id\] === true/);
});

test("member-managed connections retain confirmation and safe provider checks",()=>{
 assert.match(source,/Confirm disconnect/);
 assert.match(source,/payload\.provider !== provider\.id/);
 assert.match(source,/destination\.protocol !== "https:"/);
 assert.match(source,/ifund_connections/);
 assert.match(source,/\.eq\("owner_id", session\.user\.id\)/);
});
