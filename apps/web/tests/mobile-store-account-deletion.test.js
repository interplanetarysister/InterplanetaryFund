import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const moduleSource=read("../src/lib/accountDeletion.js");
const moduleFactory=new Function("authClient",moduleSource
  .replace(/^import[^\n]*\n/gm,"")
  .replace(/\bexport\s+(?=async|function|const)/g,"")+
  ";return {requestAccountDeletion,getMyAccountDeletionRequests};");
const ACCOUNT="11111111-1111-4111-8111-111111111111";
const REQUEST="22222222-2222-4222-8222-222222222222";
function mockClient({anonymous=false,confirmed=true,fail=false,empty=false}={}){
  const calls=[];
  const auth={getUser:async()=>({data:{user:{
    id:ACCOUNT,is_anonymous:anonymous,
    email_confirmed_at:confirmed?"2026-11-15T00:00:00Z":null,
  }},error:null})};
  const rpc=async(name,args)=>{
    calls.push(name);
    if(fail)return {data:null,error:{message:"Service rejected request"}};
    if(empty)return {data:[],error:null};
    if(name==="ifund_request_account_deletion")
      return {data:[{request_id:REQUEST,request_status:"requested",submitted_at:"2026-11-15T08:00:00Z"}],error:null};
    if(name==="ifund_my_account_deletion_requests")
      return {data:[{request_id:REQUEST,request_status:"reviewing",submitted_at:"2026-11-15T08:00:00Z",updated_at:"2026-11-15T09:00:00Z"}],error:null};
    throw new Error("Unexpected RPC");
  };
  return {auth,rpc,calls};
}
test("self-service account deletion uses its own confirmed, authenticated RPC",async()=>{
  const {requestAccountDeletion,getMyAccountDeletionRequests}=moduleFactory(()=>{throw Error("Unexpected default auth client");});
  const client=mockClient();
  const requested=await requestAccountDeletion(client);
  assert.equal(requested.id,REQUEST);
  assert.equal(requested.status,"requested");
  const history=await getMyAccountDeletionRequests(client);
  assert.equal(history.length,1);
  assert.equal(history[0].status,"reviewing");
  assert.deepEqual(client.calls,[
    "ifund_request_account_deletion","ifund_my_account_deletion_requests",
  ]);
});
test("anonymous and unconfirmed sign-in cannot request account deletion as another user",async()=>{
  const {requestAccountDeletion}=moduleFactory(()=>{throw Error("Unexpected default auth client");});
  for(const client of [mockClient({anonymous:true}),mockClient({confirmed:false})]){
    await assert.rejects(()=>requestAccountDeletion(client),/confirmed IFund email/);
    assert.deepEqual(client.calls,[]);
  }
});
test("failed deletion RPC never claims completion",async()=>{
  const {requestAccountDeletion}=moduleFactory(()=>{throw Error("Unexpected default auth client");});
  await assert.rejects(()=>requestAccountDeletion(mockClient({fail:true})),/Service rejected/);
  await assert.rejects(()=>requestAccountDeletion(mockClient({empty:true})),/could not be confirmed/);
});
test("the app and public deletion URL both use the direct account deletion process",()=>{
  const mobile=read("../src/mobile/MobileStoreDeleteAccount.jsx");
  const publicPage=read("../src/pages/DeleteAccount.jsx");
  const scope=JSON.parse(read("../../mobile/ci/store-scope.json"));
  const migration=read("../../../supabase/migrations/20261115_ifund_mobile_account_deletion_requests.sql");
  assert.match(mobile,/requestAccountDeletion\(\)/);
  assert.match(mobile,/getMyAccountDeletionRequests\(\)/);
  assert.match(publicPage,/MobileStoreDeleteAccount/);
  assert.match(migration,/ifund_request_account_deletion/);
  assert.match(migration,/enable row level security/);
  assert.match(migration,/ifund_super_admin_account_deletion_queue/);
  assert.ok(scope.routes.includes("/delete-account"));
  assert.doesNotMatch(mobile,/client\.rpc\("ifund_create_support_ticket"/);
});
