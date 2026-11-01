import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeNoticeDestination } from "../src/lib/notifications.js";
const file = p => readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("notification links preserve original safe internal destinations",()=>{
  for(const s of ["/campaign/00000000-0000-0000-0000-000000000001",
    "/community","/blogs","/dashboard","/following","/notifications","/inbox"]) assert.equal(safeNoticeDestination(s),s);
  for(const s of ["https://evil.test","//evil.test","/%5Cevil","/%2Fevil","/admin",
    "/campaign/../../admin","javascript:alert(1)","/\\evil",""]) assert.equal(safeNoticeDestination(s),null);
});

test("independent notification transport uses owner-only DB and verified user",()=>{
  const api=file("src/lib/notifications.js");
  assert.match(api,/isVerifiedEmailUser/);
  assert.match(api,/\.eq\("owner_id",owner\)/);
  assert.match(api,/\.update\(\{read:true\}\)/);
  assert.match(api,/\.select\(COLUMNS\)/);
  assert.match(api,/\.limit\(50\)/);
  assert.doesNotMatch(api,/service_role|base44|\.insert\(/i);
});

test("notifications route is actually implemented and member-gated",()=>{
  const app=file("src/App.jsx");
  const page=file("src/pages/Notifications.jsx");
  assert.match(app,/path="\/notifications" element={<MemberAccess><Notifications \/><\/MemberAccess>}/);
  assert.match(page,/Mark displayed read/);
  assert.match(page,/Notifications/);
  assert.doesNotMatch(page,/base44Client|base44\\.functions|mockNotices|SEED_NOTIFICATIONS/i);
  assert.match(page,/Android push, optional diagnostics, and administrative mail remain separate/);
});
