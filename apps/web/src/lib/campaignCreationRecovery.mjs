// A crash-safe handoff between saving the owned campaign row and saving its
// private wizard state. Only the signed-in, verified owner can discover this
// session-scoped pointer. Never write public campaign fields into this record.
import {campaignSetupPayload} from "../api/campaignSetup.js";

const PREFIX="ifund-campaign-setup-recovery-v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const indexKey=owner=>PREFIX+":owner:"+encodeURIComponent(owner);

function verifiedRecord(record,owner,campaignId=null){
  if(record?.version!==1||record?.owner_id!==owner||!UUID.test(record?.campaign_id||"")||
     !record.setup||typeof record.setup!=="object"||
     (campaignId&&record.campaign_id!==campaignId))return null;
  // Reject unexpected/legacy payload shapes; the server's setup schema is
  // authoritative. Keep a bounded normalized copy only.
  try{
    const normalized=campaignSetupPayload(record.setup,record.setup.draft_step);
    if(JSON.stringify(normalized)!==JSON.stringify(record.setup))return null;
    return {campaignId:record.campaign_id,setup:normalized};
  }catch{return null;}
}
export function rememberPendingCampaignSetup(storage,owner,campaignId,setup){
  if(!UUID.test(owner||"")||!UUID.test(campaignId||""))return false;
  try{
    const existing=storage.getItem(indexKey(owner));
    if(existing){
      let record;try{record=JSON.parse(existing);}catch{return false;}
      const prior=verifiedRecord(record,owner);
      // A failed setup save for one campaign must not be overwritten by a
      // newly created campaign. Explicitly recover or clear the older one.
      if(!prior||prior.campaignId!==campaignId)return false;
    }
    const normalized=campaignSetupPayload(setup,setup?.draft_step);
    const expected=JSON.stringify({
      version:1,owner_id:owner,campaign_id:campaignId,setup:normalized
    });
    storage.setItem(indexKey(owner),expected);
    // A storage adapter can silently ignore writes. A pre-existing record
    // for this campaign is not evidence that the latest setup was saved.
    return storage.getItem(indexKey(owner))===expected;
  }catch{return false;}
}
export function pendingCampaignSetup(storage,owner,campaignId=null){
  if(!UUID.test(owner||"")||(campaignId&&!UUID.test(campaignId)))return null;
  let raw;try{raw=storage.getItem(indexKey(owner));}catch{return null;}
  if(!raw)return null;
  try{return verifiedRecord(JSON.parse(raw),owner,campaignId);}catch{return null;}
}
export function clearPendingCampaignSetup(storage,owner,campaignId){
  if(!UUID.test(owner||"")||!UUID.test(campaignId||""))return false;
  try{
    const key=indexKey(owner),raw=storage.getItem(key);
    if(!raw)return true;
    const record=verifiedRecord(JSON.parse(raw),owner,campaignId);
    if(!record)return false;
    storage.removeItem(key);
    return storage.getItem(key)===null;
  }catch{return false;}
}
