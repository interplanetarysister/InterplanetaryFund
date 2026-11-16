import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = name => readFileSync(new URL("../" + name, import.meta.url),"utf8");
const api = read("src/lib/accountDeletion.js");
const compiled = new Function("authClient", api
  .replace(/^import[^\n]*\n/gm, "")
  .replace(/\bexport\s+(?=async|function|const)/g, "")+
  ";return {requestAccountDeletion,getMyAccountDeletionRequests};");
const id = "11111111-1111-4111-8111-111111111111";
const ref = "22222222-2222-4222-8222-222222222222";

function stub({ guest=false, verified=true, fail=false }={}) {
  const calls=[];
  return {
    calls,
    auth:{getUser:async()=>({data:{user:{id,is_anonymous:guest,email_confirmed_at:verified?"2026-11-15T22:00:00Z":null}},error:null})},
    rpc:async(name)=>{
      calls.push(name);
      if (fail) return {data:null,error:{message:"service denied"}};
      return name==="ifund_request_account_deletion" ?
        {data:[{request_id:ref,request_status:"requested",submitted_at:"2026-11-15T22:00:00Z"}],error:null}:
        {data:[{request_id:ref,request_status:"requested",submitted_at:"2026-11-15T22:00:00Z",updated_at:"2026-11-15T22:00:00Z"}],error:null};
    },
  };
}
test("account deletion is a public website route and private admin queue is guarded",()=>{
  const app=read("src/App.jsx");
  assert.match(app,/path="\/delete-account" element=\{<DeleteAccount \/>}/);
  assert.match(app,/path="\/admin\/deletions" element=\{<MemberAccess><SuperAdminAccess><AdminDeletionQueue \/><\/SuperAdminAccess><\/MemberAccess>}/);
  assert.match(read("src/pages/Privacy.jsx"),/to="\/delete-account"/);
  assert.match(read("src/pages/Profile.jsx"),/\["\/delete-account", "Delete account & data"\]/);
});
test("public deletion page uses same direct owner-verified form as the mobile app",()=>{
  const page=read("src/pages/DeleteAccount.jsx");
  const form=read("src/mobile/MobileStoreDeleteAccount.jsx");
  assert.match(page,/MobileStoreDeleteAccount/);
  assert.match(form,/requestAccountDeletion\(\)/);
  assert.match(form,/getMyAccountDeletionRequests\(\)/);
  assert.doesNotMatch(form,/ifund_create_support_ticket/);
  assert.match(form,/Your account deletion is pending/);
});
test("member and authenticated guest request and read own deletion status",async()=>{
  const {requestAccountDeletion,getMyAccountDeletionRequests}=compiled(()=>{throw Error("No implicit client");});
  for (const user of [stub(),stub({guest:true,verified:false})]) {
    assert.equal((await requestAccountDeletion(user)).id,ref);
    assert.equal((await getMyAccountDeletionRequests(user))[0].id,ref);
    assert.deepEqual(user.calls,["ifund_request_account_deletion","ifund_my_account_deletion_requests"]);
  }
});
test("unconfirmed non-guest cannot initiate and database failure is never success",async()=>{
  const {requestAccountDeletion}=compiled(()=>{throw Error("No implicit client");});
  const unconfirmed=stub({verified:false});
  await assert.rejects(()=>requestAccountDeletion(unconfirmed),/Sign in/);
  assert.deepEqual(unconfirmed.calls,[]);
  await assert.rejects(()=>requestAccountDeletion(stub({fail:true})),/service denied/);
});
test("migrations restrict public deletion access and preserve actual erasure review",()=>{
  const base=read("../../supabase/migrations/20261115_ifund_mobile_account_deletion_requests.sql");
  const guest=read("../../supabase/migrations/20261115_ifund_anonymous_guest_deletion_requests.sql");
  assert.match(base,/enable row level security/);
  assert.match(base,/revoke all on function public\.ifund_request_account_deletion\(\) from public,anon/);
  assert.match(base,/ifund_super_admin_account_deletion_queue/);
  assert.match(guest,/u\.is_anonymous is true/);
  assert.doesNotMatch(base,/delete from auth\.users/i);
});

test("restricted deletion administration provides a read-only dependency review",()=>{
  const page=read("src/pages/AdminDeletionQueue.jsx");
  const migration=read("../../supabase/migrations/20261115_ifund_account_erasure_preflight.sql");
  assert.match(page,/ifund_admin_account_erasure_preflight/);
  assert.match(page,/Review dependent data/);
  assert.match(page,/not clearance to erase/);
  assert.match(migration,/ifund_current_user_is_verified_super_admin/);
  assert.match(migration,/revoke all on function public\\.ifund_admin_account_erasure_preflight\\(uuid\\) from public, anon, authenticated/);
  assert.match(migration,/safe_to_erase', false/);
  assert.doesNotMatch(migration,/delete from auth\\.users/i);
});
