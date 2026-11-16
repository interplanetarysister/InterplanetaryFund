import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  listOwnerDocumentPermissions,
  revokeAllOwnerDocumentAgentUse
} from "../src/api/campaignDocuments.js";

const OWNER="11111111-1111-4111-8111-111111111111";
const CAMPAIGN="22222222-2222-4222-8222-222222222222";
const DOCUMENT="33333333-3333-4333-8333-333333333333";
const ROW={id:DOCUMENT,owner_id:OWNER,campaign_id:CAMPAIGN,file_name:"plan.pdf",
  purpose:"planning",agent_summary:"Owner-approved summary of the planning document.",
  owner_excerpt:"",allow_agent_use:true,deletion_requested_at:null,created_at:"2026-11-15T10:00:00Z"};

function fixture({user={id:OWNER,email_confirmed_at:"2026-11-15",is_anonymous:false},
  rows=[ROW],switchAccount=false,bypassFilter=false}={}){
  const calls=[],docs=rows.map(row=>({...row}));
  let authReads=0;
  const client={
    rpc:async name=>{
      calls.push({action:"rpc",name});
      if(name!=="ifund_campaign_documents_revoke_all_agent_use")
        return {data:null,error:{message:"Unexpected document RPC"}};
      const eligible=docs.filter(row=>row.owner_id===user.id&&row.allow_agent_use===true&&!row.deletion_requested_at);
      for(const row of eligible)row.allow_agent_use=false;
      return {data:eligible.length,error:null};
    },
    auth:{getUser:async()=>{
      authReads++;
      const current=switchAccount&&authReads>1?{...user,id:"44444444-4444-4444-8444-444444444444"}:user;
      return {data:{user:current},error:null};
    }},
    from(table){
      const filters=[];
      let action="read",update=null,offset=0,limit=100;
      const query={
        select(){return query;},eq(field,value){filters.push([field,value]);return query;},
        is(field,value){filters.push([field,value]);return query;},
        order(){return query;},range(start,end){offset=start;limit=end-start+1;return query;},
        update(value){action="update";update=value;calls.push({action,update:value});return query;},
        maybeSingle:async()=>({data:{account_status:"active",account_deletion_pending:false},error:null}),
        then(resolve,reject){
          const matches=bypassFilter?docs:docs.filter(row=>filters.every(([key,val])=>row[key]===val));
          if(action==="update")for(const row of matches)Object.assign(row,update);
          const result=action==="update"
            ?matches.map(row=>({id:row.id,owner_id:row.owner_id,allow_agent_use:row.allow_agent_use}))
            :matches.slice(offset,offset+limit);
          return Promise.resolve({data:result,error:null}).then(resolve,reject);
        }
      };
      calls.push({action:"table",table});
      return query;
    }
  };
  return {client,calls,docs};
}
test("central account permissions list only owner documents",async()=>{
  const f=fixture();
  const result=await listOwnerDocumentPermissions(f.client);
  assert.equal(result.length,1);
  assert.equal(result[0].owner_id,OWNER);
  assert.equal(result[0].allow_agent_use,true);
});
test("a foreign document in a response is rejected rather than displayed",async()=>{
  const f=fixture({bypassFilter:true,rows:[{...ROW,owner_id:"44444444-4444-4444-8444-444444444444"}]});
  await assert.rejects(listOwnerDocumentPermissions(f.client),/could not be verified/);
});
test("account switch clears permission retrieval before returning private records",async()=>{
  const f=fixture({switchAccount:true});
  await assert.rejects(listOwnerDocumentPermissions(f.client),/account changed/i);
});
test("owner-wide revocation disables agent use without deleting any file",async()=>{
  const f=fixture();
  const removed=await revokeAllOwnerDocumentAgentUse(f.client);
  assert.equal(removed,1);
  assert.equal(f.docs[0].allow_agent_use,false);
  assert.ok(f.calls.some(event=>event.action==="rpc"&&event.name==="ifund_campaign_documents_revoke_all_agent_use"));
  assert.equal(f.calls.some(event=>event.action==="delete"||event.action==="update"),false);
});
test("invalid pagination does not query other people's documents",async()=>{
  const f=fixture();
  await assert.rejects(listOwnerDocumentPermissions(f.client,{offset:-1}),/Invalid private document page/);
  await assert.rejects(listOwnerDocumentPermissions(f.client,{limit:101}),/Invalid private document page/);
  assert.equal(f.calls.length,0);
});
test("centralized My Account document controls are visible and default to revocation-safe actions",()=>{
  const account=readFileSync(new URL("../src/pages/ManagePermissions.jsx",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../src/components/permissions/CampaignDocumentPermissions.jsx",import.meta.url),"utf8");
  assert.match(account,/\["documents","Campaign documents"\]/);
  assert.match(account,/CampaignDocumentPermissions/);
  assert.match(ui,/revokeAllOwnerDocumentAgentUse/);
  assert.match(ui,/updateDocumentAgentAccess/);
  assert.match(ui,/agent_summary/);
  assert.doesNotMatch(ui,/getPublicUrl|storage\.remove/);
});

test("bulk revoke is independent of PostgREST returned row limits",async()=>{
  const rows=Array.from({length:1100},(_,i)=>({
    ...ROW,id:(i+1).toString(16).padStart(8,"0")+"-1111-4111-8111-111111111111"
  }));
  const f=fixture({rows});
  const count=await revokeAllOwnerDocumentAgentUse(f.client);
  assert.equal(count,1100);
  assert.equal(f.docs.filter(row=>row.allow_agent_use).length,0);
  assert.equal(f.calls.some(event=>event.action==="update"),false);
});
test("bulk revoke does not resurrect a document pending deletion",async()=>{
  const pending={...ROW,id:"44444444-4444-4444-8444-444444444444",deletion_requested_at:"2026-11-15T18:00:00Z",allow_agent_use:false};
  const f=fixture({rows:[ROW,pending]});
  assert.equal(await revokeAllOwnerDocumentAgentUse(f.client),1);
  assert.equal(f.docs.find(row=>row.id===pending.id).allow_agent_use,false);
});
test("bulk revoke is an invoker RPC, not a privileged cross-account update",()=>{
  const sql=readFileSync(new URL("../../supabase/migrations/20261115095000_ifund_campaign_private_documents.sql",import.meta.url),"utf8");
  assert.match(sql,/ifund_campaign_documents_revoke_all_agent_use/);
  assert.match(sql,/returns integer language plpgsql security invoker/);
  assert.match(sql,/d.owner_id=v_owner and d.allow_agent_use=true/);
  assert.match(sql,/grant execute on function public.ifund_campaign_documents_revoke_all_agent_use\(\) to authenticated/);
});
