import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {redactDocumentReferenceSecrets} from "../src/lib/documentReferenceSafety.mjs";

test("removes structured and environment credentials while preserving budget figures",()=>{
 const text='Owner-reported $2,900 equipment budget. PAYPAL_CLIENT_SECRET=secret-for-test "access_token":"another-secret"';
 const clean=redactDocumentReferenceSecrets(text);
 assert.match(clean,/\$2,900 equipment budget/);
 assert.doesNotMatch(clean,/secret-for-test|another-secret/);
 assert.match(clean,/\[redacted/);
});
test("masks bearer tokens and API key prefixes in drafts",()=>{
 const clean=redactDocumentReferenceSecrets("Bearer synthetic1234567890 sk-abcdefghijklmnopqr");
 assert.doesNotMatch(clean,/synthetic1234567890|abcdefghijklmnopqr/);
});
test("strips plain and encoded OAuth authorization URLs",()=>{
 for(const url of [
   "https://example.com/callback?code=testauth123&state=ok",
   "https://example.com/callback?%63ode=testauth123",
   "https://example.com/callback?%2563ode=testauth123"
 ]){
   assert.equal(redactDocumentReferenceSecrets(url),"[redacted authorization URL]");
 }
});
test("ambiguous escaped JSON credentials are discarded whole",()=>{
 const clean=redactDocumentReferenceSecrets(String.raw`{\"refresh_token\":\"private-test-value\"}`);
 assert.equal(clean,"[redacted credential payload]");
});
test("ordinary campaign text remains intact",()=>{
 const value="We are supporting refrigeration in our community and need 3 new refrigerators.";
 assert.equal(redactDocumentReferenceSecrets(value),value);
});
test("manual agent document insertion uses redaction without publishing files",()=>{
 const source=readFileSync(new URL("../src/components/agents/AgentDocumentReferences.jsx",import.meta.url),"utf8");
 assert.match(source,/onInsert\(redactDocumentReferenceSecrets\(facts\)\)/);
 assert.doesNotMatch(source,/storage\.upload|getPublicUrl|publishCampaign/);
});
