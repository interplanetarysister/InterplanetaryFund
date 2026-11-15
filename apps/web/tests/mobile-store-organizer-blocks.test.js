import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const moduleText = read("../src/mobile/organizerBlock.js");
// The native test harness runs in plain Node, without Vite's @ path alias.
// Replace only the import and export declarations; exercise the exact module body.
const load = new Function("authClient", moduleText
  .replace(/^import[^\n]*\n/gm, "")
  .replace(/\bexport\s+(?=async|function|const)/g, "") +
  ";return {blockedOrganizerIds,blockOrganizer,unblockOrganizer,verifiedOrganizersForCampaigns};");
const OWNER = "22222222-2222-4222-8222-222222222222";
const VIEWER = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "33333333-3333-4333-8333-333333333333";

function fakeClient({anonymous=false,confirmed=true,rpcSuccess=true,failBlockRead=false}={}){
  const records=new Set();
  const calls={rpc:[],ownerReads:0};
  const auth={getUser:async()=>({data:{user:{
    id:VIEWER,is_anonymous:anonymous,
    email_confirmed_at:confirmed?"2026-11-15T00:00:00Z":null,
  }},error:null})};
  const from = name=>({
    select:()=>({
      limit:async()=>failBlockRead?{data:null,error:{message:"service down"}}:
        {data:[...records].map(organizer_id=>({organizer_id})),error:null},
      eq:()=>({
        in:async()=>{calls.ownerReads++;return {data:[{id:CAMPAIGN,owner_id:OWNER}],error:null};},
      }),
    }),
  });
  const rpc=async(name,args)=>{
    calls.rpc.push({name,args});
    if(!rpcSuccess)return {data:null,error:{message:"Request rejected"}};
    if(name==="ifund_mobile_block_organizer")records.add(args.p_organizer);
    if(name==="ifund_mobile_unblock_organizer")records.delete(args.p_organizer);
    return {data:true,error:null};
  };
  return {auth,from,rpc,calls,records};
}

test("signed-in organizer blocks persist using verified owner RPCs",async()=>{
  const {blockedOrganizerIds,blockOrganizer,unblockOrganizer}=load(()=>{throw Error("No implicit test credentials")});
  const client=fakeClient();
  assert.deepEqual(await blockedOrganizerIds(client),[]);
  assert.equal(await blockOrganizer(OWNER,client),true);
  assert.deepEqual(await blockedOrganizerIds(client),[OWNER]);
  assert.deepEqual(client.calls.rpc[0],{
    name:"ifund_mobile_block_organizer",args:{p_organizer:OWNER},
  });
  assert.equal(await unblockOrganizer(OWNER,client),true);
  assert.deepEqual(await blockedOrganizerIds(client),[]);
  assert.deepEqual(client.calls.rpc[1],{
    name:"ifund_mobile_unblock_organizer",args:{p_organizer:OWNER},
  });
});

test("no confirmed user, anonymous visitor or self-block can call RPC",async()=>{
  const {blockedOrganizerIds,blockOrganizer}=load(()=>{throw Error("No implicit test credentials")});
  for(const client of [fakeClient({anonymous:true}),fakeClient({confirmed:false})]){
    await assert.rejects(()=>blockedOrganizerIds(client),/confirmed email account/);
    await assert.rejects(()=>blockOrganizer(OWNER,client),/confirmed email account/);
    assert.equal(client.calls.rpc.length,0);
  }
  const client=fakeClient();
  await assert.rejects(()=>blockOrganizer(VIEWER,client),TypeError);
  assert.equal(client.calls.rpc.length,0);
});

test("blocked organizer must be independently confirmed before reporting success",async()=>{
  const {blockedOrganizerIds,blockOrganizer}=load(()=>{throw Error("No implicit test credentials")});
  const refused=fakeClient({rpcSuccess:false});
  await assert.rejects(()=>blockOrganizer(OWNER,refused),/Request rejected/);
  const inaccessible=fakeClient({failBlockRead:true});
  await assert.rejects(()=>blockOrganizer(OWNER,inaccessible),/could not be verified/);
  await assert.rejects(()=>blockedOrganizerIds(inaccessible),/could not be verified/);
});

test("public/anonymous users cannot resolve private organizer IDs",async()=>{
  const {verifiedOrganizersForCampaigns}=load(()=>{throw Error("No implicit test credentials")});
  const anon=fakeClient({anonymous:true});
  await assert.rejects(()=>verifiedOrganizersForCampaigns([CAMPAIGN],anon),/confirmed email account/);
  assert.equal(anon.calls.ownerReads,0);
  const signed=fakeClient();
  const matches=await verifiedOrganizersForCampaigns([CAMPAIGN],signed);
  assert.equal(matches.get(CAMPAIGN),OWNER);
  assert.equal(signed.calls.ownerReads,1);
  await assert.rejects(()=>verifiedOrganizersForCampaigns(["not-a-uuid"],signed),TypeError);
});

test("campaign, discover, saved and account views use the shared live block service",()=>{
  const campaign=read("../src/mobile/MobileStoreCampaign.jsx");
  const discover=read("../src/mobile/MobileStoreDiscover.jsx");
  const saved=read("../src/mobile/MobileStoreSaved.jsx");
  const account=read("../src/mobile/MobileStoreAccount.jsx");
  assert.match(campaign,/await blockOrganizer\(organizerId\)/);
  assert.match(campaign,/await Promise\.all|Promise\.all\(/);
  assert.doesNotMatch(campaign,/readBlockedOrganizers/);
  assert.match(discover,/blockedOrganizerIds\(\)/);
  assert.match(discover,/blockState==="error"/);
  assert.match(saved,/blockedOrganizerIds\(\)/);
  assert.match(saved,/phase==="error"/);
  assert.match(account,/await unblockOrganizer\(id\)/);
  assert.doesNotMatch(account,/clearBlockedOrganizers|readBlockedOrganizers/);
});
