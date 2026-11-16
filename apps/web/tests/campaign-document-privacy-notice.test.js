import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PRIVACY_SECTIONS} from "../src/lib/legalPolicy.js";

test("privacy notice explains disabled-by-default agent access to private campaign documents",()=>{
  const section=PRIVACY_SECTIONS.find(item=>item.title.includes("Private campaign documents"));
  assert.ok(section);
  const text=section.paragraphs.join(" ");
  assert.match(text,/off by default/);
  assert.match(text,/private/);
  assert.match(text,/Revoke agent use/);
  assert.match(text,/PDF, Word, and Excel files are not described as automatically extracted/);
  assert.match(text,/prior owner-reviewed drafts/);
  assert.match(text,/removal remains pending/);
});
test("web and signed mobile account deletion disclose document cleanup and retention honestly",()=>{
  const source=readFileSync(new URL("../src/mobile/MobileStoreDeleteAccount.jsx",import.meta.url),"utf8");
  assert.match(source,/Eligible private fundraising documents/);
  assert.match(source,/verified, retryable Storage deletion/);
  assert.match(source,/not completed when you submit this request/);
});
test("document claims do not override financial data verification",()=>{
  const source=readFileSync(new URL("../src/lib/legalPolicy.js",import.meta.url),"utf8");
  assert.match(source,/Organizer-supplied descriptions are not independently verified evidence/);
  assert.match(source,/any legally required retention/);
});
