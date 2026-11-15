import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const admin=readFileSync(new URL("../src/pages/AdminConnections.jsx",import.meta.url),"utf8");
const member=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");
test("admin integrations route exists, is server-role guarded, and cannot leak secrets",()=>{
 assert.match(app,/path="\/admin\/integrations" element=\{<MemberAccess><AdminAccess><AdminConnections \/><\/AdminAccess><\/MemberAccess>\}/);
 assert.match(admin,/\/api\/oauth\/status/);
 assert.match(admin,/These binding names belong in the Cloudflare Worker environment/);
 assert.match(admin,/never exposes credentials/);
 assert.match(app,/path="\/admin\/integrations" element=\{<MemberAccess><AdminAccess>/);
 assert.match(member,/adminStatus==="admin" && <details/);
 assert.doesNotMatch(member,/SUPABASE_SECRET_KEY|OAUTH_ENCRYPTION_KEY/);
});
