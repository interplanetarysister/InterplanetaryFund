import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyCampaignForm,
  validateCampaignForm,
  buildCampaignPayload,
  publishReadiness,
} from "../src/lib/campaignLifecycle.js";
import {
  rememberBrowserCampaign,
  restoreBrowserCampaign,
} from "../src/lib/browserCampaignDraft.js";

function sample() {
  return {
    ...emptyCampaignForm(),
    title:"Community aid fundraiser",
    summary:"Helping neighbors",
    story:"Our community has an urgent need.",
    goal_amount:"5000",
  };
}
test("Atlas opt-in defaults OFF; writes neither map coordinates nor public label", () => {
  const form = sample();
  const payload = buildCampaignPayload(form,"draft");
  assert.equal(payload.map_opt_in,false);
  assert.equal(payload.map_latitude,null);
  assert.equal(payload.map_longitude,null);
  assert.equal(payload.public_location_label,null);
  assert.deepEqual(validateCampaignForm(form,{publish:true}),[]);
});
test("Opted-in broad public coordinates survive a validated campaign payload", () => {
  const form = {...sample(),map_opt_in:true,public_location_label:"Seattle area, Washington",map_latitude:"47.6",map_longitude:"-122.3"};
  assert.deepEqual(validateCampaignForm(form,{publish:true}),[]);
  assert.equal(publishReadiness(form).ready,true);
  const payload = buildCampaignPayload(form,"active");
  assert.equal(payload.map_opt_in,true);
  assert.equal(payload.public_location_label,"Seattle area, Washington");
  assert.equal(payload.map_latitude,47.6);
  assert.equal(payload.map_longitude,-122.3);
});
test("Atlas rejects missing region, precise GPS, invalid lat/long and overlong public labels", () => {
  const base = {...sample(),map_opt_in:true,public_location_label:"Seattle",map_latitude:"47.6",map_longitude:"-122.3"};
  const invalid = [
    {...base,public_location_label:""},
    {...base,public_location_label:"Z".repeat(81)},
    {...base,map_latitude:"47.6243"},
    {...base,map_longitude:"-122.3321"},
    {...base,map_latitude:"95.0"},
    {...base,map_longitude:"-181.0"},
    {...base,map_latitude:""},
    {...base,map_longitude:"NaN"},
  ];
  for(const form of invalid) assert.notDeepEqual(validateCampaignForm(form,{publish:true}),[],JSON.stringify(form));
});
test("Atlas opt-out removes any previously supplied location, even if form keeps stale strings", () => {
  const form={...sample(),map_opt_in:false,public_location_label:"Private street",map_latitude:"40.4",map_longitude:"-70.3"};
  assert.equal(validateCampaignForm(form,{publish:true}).length,0);
  const saved=buildCampaignPayload(form,"active");
  assert.deepEqual(
    [saved.map_opt_in,saved.public_location_label,saved.map_latitude,saved.map_longitude],
    [false,null,null,null],
  );
});
test("Guest drafts retain map consent without crossing a second owner", () => {
  const store=new Map();
  const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  const form={...sample(),map_opt_in:true,public_location_label:"Seattle",map_latitude:"47.6",map_longitude:"-122.3"};
  rememberBrowserCampaign(storage,"owner-a",form,{});
  assert.deepEqual(restoreBrowserCampaign(storage,"owner-a").map_opt_in,true);
  assert.equal(restoreBrowserCampaign(storage,"owner-b").map_opt_in,false);
});

test("Map consent validation is independent of user-provided fundraising values", () => {
  const form={...sample(),map_opt_in:true,public_location_label:"New York metro area",map_latitude:"40.7",map_longitude:"-74.0",goal_amount:"100.25"};
  assert.deepEqual(validateCampaignForm(form,{publish:true}),[]);
  assert.equal(buildCampaignPayload(form,"active").goal_amount,100.25);
  form.map_opt_in=false;
  assert.equal(buildCampaignPayload(form,"active").map_longitude,null);
});
