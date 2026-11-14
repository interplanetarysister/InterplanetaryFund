import test from "node:test";
import assert from "node:assert/strict";
import { mapAtlasCampaign, atlasLocationRows, atlasLocationSummary, isApprovedAtlasLocation } from "../src/lib/atlasLocations.mjs";

const campaign=(overrides={})=>({
 id:"00000000-0000-4000-8000-000000000001",title:"Community Garden",
 status:"active",category:"environment",map_opt_in:true,
 public_location_label:"Seattle area, Washington",map_latitude:47.6,map_longitude:-122.3,...overrides,
});
test("owner campaigns are shaped for Atlas without exposing financials or private details",()=>{
 const row=mapAtlasCampaign({...campaign(),owner_id:"private-account",story:"private words",goal_amount:1000});
 assert.equal(row.location,"Seattle area, Washington");
 assert.equal(row.latitude,47.6);
 for(const field of ["owner_id","story","goal_amount","raised_amount","donor_count"]) assert.equal(field in row,false);
});
test("missing or opted-out locations cannot make public markers",()=>{
 for(const entry of [
  campaign({map_opt_in:false}), campaign({map_latitude:null}),
  campaign({public_location_label:""}),campaign({map_longitude:200}),
  campaign({map_latitude:""}),campaign({map_latitude:"invalid"})
 ]) assert.equal(isApprovedAtlasLocation(mapAtlasCampaign(entry)),false);
});
test("location grouping uses only published, opted-in markers",()=>{
 const approved=mapAtlasCampaign(campaign());
 const duplicate=mapAtlasCampaign(campaign({public_location_label:" seattle  area, washington "}));
 const another=mapAtlasCampaign(campaign({public_location_label:"Portland, Oregon",map_latitude:45.5,map_longitude:-122.7}));
 const draft=mapAtlasCampaign(campaign({status:"draft"}));
 const optedOut=mapAtlasCampaign(campaign({map_opt_in:false}));
 const rows=atlasLocationRows([approved,duplicate,another,draft,optedOut]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].value,2);
 assert.equal(atlasLocationSummary([approved,duplicate,another,draft,optedOut]).nonPublic,1);
 assert.deepEqual(atlasLocationSummary([approved,duplicate,another,draft,optedOut]),{
  published:4,mapped:3,unmapped:1,nonPublic:1
 });
});
test("no campaign geolocation inferred from title or owner profile",()=>{
 const row=mapAtlasCampaign(campaign({map_opt_in:false,title:"Save Seattle trees",public_location_label:"Seattle",map_latitude:47.6,map_longitude:-122.3}));
 assert.equal(row.location,"");
 assert.equal(row.latitude,null);
 assert.equal(row.longitude,null);
});
