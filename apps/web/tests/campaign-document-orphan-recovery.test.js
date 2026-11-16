import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  findStaleCampaignDocumentUploads,removeStaleCampaignDocumentUpload
} from "../src/api/campaignDocuments.js";

const OWNER="11111111-1111-4111-8111-111111111111";
const CAMPAIGN="22222222-2222-4222-8222-222222222222";
const ID="33333333-3333-4333-8333-333333333333";
const PREFIX=OWNER+"/"+CAMPAIGN+"/";
const PATH=PREFIX+ID+".pdf";
const NOW=Date.parse("2026-11-16T12:00:00Z");
const OLD="2026-11-14T10:00:00Z";
const RECENT="2026-11-16T11:00:00Z";

function fixture({files=[{id:ID,name:ID+".pdf",created_at:OLD}],
  records=[],metadataExists=false,removeError=null,infoCode="NoSuchKey",
  switchUser=false}={}){
  const events=[];let getUserCalls=0;
  const client={
    auth:{getUser:async()=>{
      getUserCalls++;
      return {data:{user:{id:switchUser&&getUserCalls>1
        ?"44444444-4444-4444-8444-444444444444":OWNER,
        email_confirmed_at:"2026-11-15",is_anonymous:false}},error:null};
    }},
    from(table){
      const filters=[],query={
        select(){return query;},eq(key,value){filters.push([key,value]);return query;},
        order(){return query;},limit(){return query;},maybeSingle:async()=>({
          data:table==="ifund_profiles"
            ?{account_status:"active",account_deletion_pending:false}
            :{id:CAMPAIGN,owner_id:OWNER,status:"draft"},error:null
        }),
        then(resolve,reject){
          const data=table==="ifund_campaign_documents"
            ?filters.some(([name])=>name==="storage_path")
              ?(metadataExists?[{id:ID}]:[])
              :records
            :[];
          return Promise.resolve({data,error:null}).then(resolve,reject);
        }
      };
      events.push({action:"db",table,filters});
      return query;
    },
    storage:{from:bucket=>{
      assert.equal(bucket,"ifund-campaign-documents");
      return {
        list:async(prefix,options)=>{
          events.push({action:"list",prefix,options});
          return {data:files,error:null};
        },
        remove:async paths=>{
          events.push({action:"remove",paths});
          return {data:[],error:removeError};
        },
        info:async path=>{
          events.push({action:"info",path});
          return {data:null,error:{code:infoCode}};
        }
      };
    }}
  };
  return {client,events};
}

test("only an owned campaign's old unregistered uploads are offered for recovery",async()=>{
  const x=fixture({files:[
    {id:ID,name:ID+".pdf",created_at:OLD},
    {id:ID,name:"not-an-upload.pdf",created_at:OLD},
    {id:ID,name:"55555555-5555-4555-8555-555555555555.pdf",created_at:RECENT},
  ]});
  const result=await findStaleCampaignDocumentUploads(x.client,CAMPAIGN,{now:NOW});
  assert.deepEqual(result.map(item=>item.path),[PATH]);
  assert.equal(x.events.find(item=>item.action==="list").prefix,OWNER+"/"+CAMPAIGN);
});
test("registered document cannot be mistaken for an orphan",async()=>{
  const x=fixture({records:[{id:ID,owner_id:OWNER,campaign_id:CAMPAIGN,storage_path:PATH}]});
  assert.deepEqual(await findStaleCampaignDocumentUploads(x.client,CAMPAIGN,{now:NOW}),[]);
});
test("a newly uploaded file is never removed during an in-flight metadata insert",async()=>{
  const x=fixture({files:[{id:ID,name:ID+".pdf",created_at:RECENT}]});
  await assert.rejects(removeStaleCampaignDocumentUpload(x.client,CAMPAIGN,PATH,{now:NOW}),/not a verified stale upload/);
  assert.equal(x.events.some(event=>event.action==="remove"),false);
});
test("a metadata row created after recovery scan blocks removal",async()=>{
  const x=fixture({metadataExists:true});
  await assert.rejects(removeStaleCampaignDocumentUpload(x.client,CAMPAIGN,PATH,{now:NOW}),/registered or cannot be safely verified/);
  assert.equal(x.events.some(event=>event.action==="remove"),false);
});
test("invalid or cross-owner file path cannot enter private Storage deletion",async()=>{
  const x=fixture();
  await assert.rejects(removeStaleCampaignDocumentUpload(x.client,CAMPAIGN,
    "44444444-4444-4444-8444-444444444444/"+CAMPAIGN+"/"+ID+".pdf",{now:NOW}),/Only an owned/);
  assert.equal(x.events.some(event=>event.action==="remove"),false);
});
test("failed Storage removal never reports a recovered upload",async()=>{
  const x=fixture({removeError:{message:"Storage unavailable"}});
  await assert.rejects(removeStaleCampaignDocumentUpload(x.client,CAMPAIGN,PATH,{now:NOW}),/could not be removed/);
});
test("NoSuchBucket cannot be mistaken for verified private file absence",async()=>{
  const x=fixture({infoCode:"NoSuchBucket"});
  await assert.rejects(removeStaleCampaignDocumentUpload(x.client,CAMPAIGN,PATH,{now:NOW}),/may still exist/);
});
test("verified stale orphan removal confirms missing object before success",async()=>{
  const x=fixture();
  assert.equal(await removeStaleCampaignDocumentUpload(x.client,CAMPAIGN,PATH,{now:NOW}),true);
  const erase=x.events.findIndex(event=>event.action==="remove");
  const proof=x.events.findIndex(event=>event.action==="info");
  assert.ok(erase>=0&&proof>erase);
  assert.deepEqual(x.events[erase].paths,[PATH]);
});
test("campaign change hides prior campaign's stale orphan names before effects run",()=>{
  const ui=readFileSync(new URL("../src/components/campaigns/CampaignDocuments.jsx",import.meta.url),"utf8");
  assert.match(ui,/const visibleOrphans=scopeMatches&&!accountLocked\?staleUploads:\[\]/);
  assert.match(ui,/visibleOrphans\.map/);
  assert.match(ui,/removeStaleCampaignDocumentUpload/);
});

test("large Storage inventories fail closed instead of showing a partial orphan list",async()=>{
  const files=Array.from({length:100},(_,n)=>({
    id:ID,name:n.toString(16).padStart(8,"0")+"-3333-4333-8333-333333333333.pdf",
    created_at:OLD
  }));
  const x=fixture({files});
  await assert.rejects(findStaleCampaignDocumentUploads(x.client,CAMPAIGN,{now:NOW}),/too large for safe recovery/);
  assert.equal(x.events.some(event=>event.action==="remove"),false);
});
test("switching accounts during Storage listing refuses stale owner references",async()=>{
  const x=fixture({switchUser:true});
  await assert.rejects(findStaleCampaignDocumentUploads(x.client,CAMPAIGN,{now:NOW}),/account changed/i);
  assert.equal(x.events.some(event=>event.action==="remove"),false);
});
test("invalid Storage object names are ignored instead of trusted for cleanup",async()=>{
  const x=fixture({files:[
    {id:ID,name:"../"+ID+".pdf",created_at:OLD},
    {id:ID,name:ID+".pdf/foreign",created_at:OLD},
    {id:null,name:ID+".pdf",created_at:OLD}
  ]});
  assert.deepEqual(await findStaleCampaignDocumentUploads(x.client,CAMPAIGN,{now:NOW}),[]);
});
