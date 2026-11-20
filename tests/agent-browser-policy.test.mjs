import test from "node:test";
import assert from "node:assert/strict";
import {browserTarget,permittedReadRequest,safeAuditPath} from "../scripts/agent-browser-policy.mjs";
import {parseArgs} from "../scripts/agent-browser-audit.mjs";
test("browser target allowlist is exact",()=>{
 for(const u of ["https://interplanetaryfund.com/","https://www.interplanetaryfund.com/dashboard","http://localhost:5173/"]) assert.equal(browserTarget(u).href,u);
 for(const u of ["https://example.org","http://interplanetaryfund.com","https://interplanetaryfund.com.evil.test","file:///etc/passwd","https://user:pass@interplanetaryfund.com"]) assert.throws(()=>browserTarget(u));
});
test("read-only requests prohibit mutations and arbitrary destinations",()=>{
 const t="https://interplanetaryfund.com";
 assert.equal(permittedReadRequest(t+"/discover","GET",t),true);
 assert.equal(permittedReadRequest("https://ssibsfmtodgximseeqsv.supabase.co/rest/v1/campaigns","GET",t),true);
 for(const m of ["POST","PUT","PATCH","DELETE"]) assert.equal(permittedReadRequest(t+"/api/payments",m,t),false);
 assert.equal(permittedReadRequest("https://evil.test","GET",t),false);
});
test("report paths remove URL query credentials and reject unsafe arguments",()=>{
 assert.equal(safeAuditPath("https://interplanetaryfund.com/dashboard?token=secret"),"https://interplanetaryfund.com/dashboard");
 assert.equal(parseArgs(["--mobile"]).mobile,true);
 assert.throws(()=>parseArgs(["--execute"]));
});
