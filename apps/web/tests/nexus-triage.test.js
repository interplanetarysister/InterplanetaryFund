import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nexusCampaignPriorities } from "../src/lib/nexusTriage.mjs";
const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
test("NEXUS prioritizes draft, unverified activity, and no followers without inventing metrics",()=>{
 const rows=[
  {campaign_id:"d",campaign_title:"Draft",campaign_status:"draft",verified_captures:0,active_followers:0},
  {campaign_id:"a",campaign_title:"Active",campaign_status:"active",verified_captures:0,active_followers:3},
  {campaign_id:"b",campaign_title:"Growth",campaign_status:"published",verified_captures:3,active_followers:0},
  {campaign_id:"c",campaign_title:"Healthy",campaign_status:"active",verified_captures:4,active_followers:2},
 ];
 assert.deepEqual(nexusCampaignPriorities(rows).map(x=>x.campaignId),["d","a","b"]);
 assert.equal(nexusCampaignPriorities(null),null);
 assert.deepEqual(nexusCampaignPriorities([]),[]);
});
test("NEXUS ignores missing/unsafe counts instead of converting them to zero",()=>{
 assert.deepEqual(nexusCampaignPriorities([{campaign_id:"a",campaign_status:"active",verified_captures:null,active_followers:0}]),[]);
 assert.deepEqual(nexusCampaignPriorities([{campaign_id:"a",campaign_status:"active",verified_captures:"1e30",active_followers:0}]),[]);
});
test("NEXUS only reads owner scope and never executes mutations or calls Base44",()=>{
 const source=read("../src/components/agents/NexusBrief.jsx");
 const team=read("../src/pages/AgentsTeam.jsx");
 assert.match(source,/rpc\("ifund_owner_campaign_engagement"\)/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|base44|\/functions\/v1/);
 assert.match(source,/No AI credits used/);
 assert.match(source,/No checklist priorities were identified/);
 assert.match(team,/selected === "nexus"/);
});
