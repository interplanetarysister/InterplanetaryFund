import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = name => readFileSync(new URL("../"+name, import.meta.url),"utf8");
const app = read("src/App.jsx");
const notice = read("src/pages/LegacyAuthorizationNotice.jsx");
test("retired Base44 OAuth consent has an explicit safe route, not an approval UI",()=>{
 assert.match(app,/path="\/oauth\/consent" element=\{<LegacyAuthorizationNotice \/>\}/);
 assert.doesNotMatch(app,/ComingSoon/);
 assert.match(notice,/No account[\s\S]*access or permissions have been granted/);
 assert.match(notice,/to="\/connections"/);
 for(const forbidden of [/new URLSearchParams/,/searchParams/,/URLSearchParams/,/window\.location\.search/,/fetch\(/,/\bredirect_uri\s*[:=]/,/oauth\/authorize/,/oauth\/token/])
   assert.doesNotMatch(notice, forbidden);
});
