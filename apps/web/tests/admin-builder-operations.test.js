import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const ui=read("../src/components/agents/BuilderOperationalReview.jsx");
const studio=read("../src/pages/AdminStudio.jsx");
const app=read("../src/App.jsx");
const sql=read("../../../supabase/migrations/20261113_ifund_super_admin_operational_snapshot.sql");
test("private Admin Builder diagnostics require verified super-admin authority",()=>{
 assert.match(app,/path="\/admin\/studio" element=\{<MemberAccess><SuperAdminAccess><AdminStudio \/><\/SuperAdminAccess><\/MemberAccess>\}/);
 assert.match(sql,/ifund_current_user_is_verified_super_admin\(\)/);
 assert.match(sql,/revoke all on function public\.ifund_super_admin_operational_snapshot\(\) from public, anon/);
 assert.match(ui,/rpc\("ifund_super_admin_operational_snapshot"\)/);
 assert.match(studio,/<BuilderOperationalReview \/>/);
});
test("Admin Builder reports actual database diagnostics without issuing engineering changes",()=>{
 for(const key of ["unresolved_platform_incidents","failed_workflow_jobs","overdue_workflow_jobs"])assert.ok(ui.includes(key));
 assert.match(ui,/does not edit source code/);
 assert.match(ui,/Super-admin approval remains/);
 assert.doesNotMatch(ui,/\.insert\(|\.update\(|\.delete\(|\/api\/builder|deploy\(|create_pull_request/);
});
