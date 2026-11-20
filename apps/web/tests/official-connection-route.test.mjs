import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("actual owner Connections workflow is rendered at /connections, not replaced by permissions",()=>{
 const app=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/pages/Connections.jsx",import.meta.url),"utf8");
 assert.match(app,/const Connections = lazy\(\(\) => import\("\.\/pages\/Connections"\)\)/);
 assert.match(app,/<Route path="\/connections" element=\{<MemberAccess><Connections \/><\/MemberAccess>\}/);
 assert.match(app,/<Route path="\/permissions" element=\{<MemberAccess><ManagePermissions \/><\/MemberAccess>\}/);
 assert.match(page,/ifund_connections/);
 assert.match(page,/ifund_my_public_links/);
 assert.match(page,/\/api\/oauth\/status/);
});
