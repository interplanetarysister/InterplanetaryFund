import {campaignSetupPayload} from '../api/campaignSetup.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIX='ifund-pending-campaign-setup-v1:owner:';
const MAX_RECORD_BYTES=220000;
const identifier=value=>typeof value==='string'&&UUID.test(value)?value.toLowerCase():null;
const keyFor=owner=>PREFIX+owner;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

// A recovery receipt is written only after the caller verifies the campaign's
// core save. It does not prove ownership or authorize publishing. The caller
// must verify the saved draft on the server before restoring this private setup.
function readRecord(storage,owner){
 const raw=storage.getItem(keyFor(owner));
 if(raw===null)return {state:'absent'};
 if(typeof raw!=='string'||raw.length>MAX_RECORD_BYTES||new TextEncoder().encode(raw).length>MAX_RECORD_BYTES)
  return {state:'invalid'};
 let record;try{record=JSON.parse(raw);}catch{return {state:'invalid'};}
 if(!isObject(record)||Object.keys(record).length!==4||record.version!==1||
  identifier(record.owner_id)!==owner||!identifier(record.campaign_id)||!isObject(record.setup))
  return {state:'invalid'};
 try{
  return {state:'ready',raw,campaignId:identifier(record.campaign_id),
   setup:campaignSetupPayload(record.setup,record.setup.draft_step)};
 }catch{return {state:'invalid'};}
}

export function rememberPendingCampaignSetup(storage,ownerId,campaignId,setup){
 const owner=identifier(ownerId),campaign=identifier(campaignId);
 if(!owner||!campaign||!isObject(setup))return false;
 try{
  const normalized=campaignSetupPayload(setup,setup.draft_step);
  const raw=JSON.stringify({version:1,owner_id:owner,campaign_id:campaign,setup:normalized});
  if(new TextEncoder().encode(raw).length>MAX_RECORD_BYTES)return false;
  const previous=readRecord(storage,owner);
  // Never overwrite unverifiable bytes or another campaign's unfinished work.
  if(previous.state==='invalid'||previous.state==='ready'&&previous.campaignId!==campaign)return false;
  storage.setItem(keyFor(owner),raw);
  return storage.getItem(keyFor(owner))===raw;
 }catch{return false;}
}

export function pendingCampaignSetup(storage,ownerId,campaignId){
 const owner=identifier(ownerId),campaign=campaignId===undefined?undefined:identifier(campaignId);
 if(!owner||campaignId!==undefined&&!campaign)return null;
 try{
  const record=readRecord(storage,owner);
  if(record.state!=='ready'||campaign!==undefined&&record.campaignId!==campaign)return null;
  return {campaignId:record.campaignId,setup:record.setup};
 }catch{return null;}
}

export function clearPendingCampaignSetup(storage,ownerId,campaignId){
 const owner=identifier(ownerId),campaign=identifier(campaignId);
 if(!owner||!campaign)return false;
 try{
  const record=readRecord(storage,owner);
  if(record.state==='absent')return true;
  if(record.state!=='ready'||record.campaignId!==campaign)return false;
  if(storage.getItem(keyFor(owner))!==record.raw)return false;
  storage.removeItem(keyFor(owner));
  return storage.getItem(keyFor(owner))===null;
 }catch{return false;}
}
