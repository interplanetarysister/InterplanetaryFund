import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("connections route opens the unified permissions hub with the actual provider workflow embedded",()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const hub=readFileSync(new URL("../src/pages/ManagePermissions.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");
 assert.match(app,/<Route path="\/connections" element=\{<MemberAccess><ManagePermissions \/><\/MemberAccess>\}/);
 assert.match(app,/<Route path="\/permissions" element=\{<MemberAccess><ManagePermissions \/><\/MemberAccess>\}/);
 assert.match(hub,/location\.pathname === "\/connections" \? "platforms"/);
 assert.match(hub,/<Connections\s*\/>/);
 assert.match(page,/ifund_connections/);
 assert.match(page,/ifund_my_public_links/);
 assert.match(page,/\/api\/oauth\/status/);
});
