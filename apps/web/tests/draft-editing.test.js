import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
test("draft links reopen and update the owned draft",()=>{
 assert.match(source,/useSearchParams/);
 assert.match(source,/params\.get\("draft"\)/);
 assert.match(source,/loadOwnerCampaign\(authClient\(\), draftId\)/);
 assert.match(source,/data\.status !== "draft"/);
 assert.match(source,/saveOwnerCampaign\(client, form, \{/);
 assert.match(source,/expectedStatus: campaignId\.current \? "draft" : undefined/);
 assert.match(source,/expectedUpdatedAt: campaignId\.current \? revision : undefined/);
 assert.doesNotMatch(source,/\.from\("ifund_campaigns"\)/);
});
test("form submission saves privately and publishing requires a separate explicit action",()=>{
 assert.match(source,/onSubmit=\{event => \{ event\.preventDefault\(\); save\("draft"\); \}\}/);
 assert.match(source,/<button type="button" onClick=\{\(\) => save\("active"\)\}/);
 assert.match(source,/saveLock\.current/);
 assert.doesNotMatch(source,/paypal\.capture|stripe/);
});
