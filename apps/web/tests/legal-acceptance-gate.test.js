import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../../"+p,import.meta.url),"utf8");

test("legal acceptance requires authenticated owner and affirmative explicit consent",()=>{
 const module=read("apps/web/src/lib/legalAcceptance.js");
 const sql=read("supabase/migrations/pending/20261029_ifund_legal_acceptances.sql");
 const gate=read("apps/web/src/components/TermsAcceptance.jsx");
 assert.match(module,/auth\.getUser\(\)/);
 assert.match(module,/explicit_consent!==true/);
 assert.match(module,/accepted_at/);
 assert.match(sql,/owner_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/explicit_consent=true/);
 assert.match(sql,/REVOKE ALL/);
 assert.match(sql,/GRANT INSERT \(owner_id,terms_version,explicit_consent\)/);
 assert.doesNotMatch(sql,/GRANT UPDATE|GRANT DELETE/i);
 assert.match(gate,/if\(exempt \|\| phase==="ready"&&!user\)return children/);
 assert.match(gate,/Agreement could not be saved/);
});

test("signup never bypasses email confirmation and Terms gate fails closed",()=>{
 const auth=read("apps/web/src/pages/AuthPage.jsx");
 const gate=read("apps/web/src/components/TermsAcceptance.jsx");
 const readiness=read("docs/migration/contracts/auth-verification.json");
 assert.match(auth,/email_confirmed_at/);
 assert.match(auth,/email_not_confirmed/);
 assert.match(auth,/signUp\(/);
 assert.match(gate,/No protected content was loaded/);
 assert.equal(readiness.provider_configuration.redirect_allowlist_verified,false);
 assert.equal(readiness.real_world_qa.email_link_verified_in_browser,false);
 assert.equal(readiness.real_world_qa.first_session_created_and_persisted,false);
});
