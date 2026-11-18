import {campaignSetupPayload} from "../api/campaignSetup.js";
const PREFIX="ifund-campaign-wizard-v1";
export const WIZARD_STEPS=Object.freeze(["Optional AI preparation","Campaign basics","Your story","Review and launch"]);
const keyFor=(owner,campaign)=>PREFIX+":"+(owner?"owner:"+encodeURIComponent(owner):"guest")+":"+encodeURIComponent(campaign||"new");
// Start new campaigns at the first of three essential pages; stage 0 remains accessible for optional AI preparation and legacy drafts.
export function emptyWizard(){return campaignSetupPayload({},1);}
export function restoreWizard(storage,owner,campaign=null){
  let raw;try{raw=storage.getItem(keyFor(owner,campaign));}catch{return emptyWizard();}
  if(!raw)return emptyWizard();
  let record;try{record=JSON.parse(raw);}catch{return emptyWizard();}
  if(record?.version!==1||record.owner_id!==(owner||null)||record.campaign_id!==(campaign||null)||!record.setup||typeof record.setup!=="object")return emptyWizard();
  try{return campaignSetupPayload(record.setup,record.setup.draft_step);}catch{return emptyWizard();}
}
export function rememberWizard(storage,owner,campaign,setup){
  try{
    const key=keyFor(owner,campaign),raw=storage.getItem(key);
    if(raw){let previous;try{previous=JSON.parse(raw);}catch{return false;}
      if(previous?.version!==1||previous.owner_id!==(owner||null)||previous.campaign_id!==(campaign||null))return false;}
    const serialized=JSON.stringify({version:1,owner_id:owner||null,campaign_id:campaign||null,setup:campaignSetupPayload(setup,setup.draft_step)});
    storage.setItem(key,serialized);
    return storage.getItem(key)===serialized;
  }catch{return false;}
}
export function forgetWizard(storage,owner,campaign=null){
  const key=keyFor(owner,campaign);
  let raw;try{raw=storage.getItem(key);}catch{return false;}
  if(!raw)return true;
  let record;try{record=JSON.parse(raw);}catch{return false;}
  if(record?.version!==1||record.owner_id!==(owner||null)||record.campaign_id!==(campaign||null))return false;
  try{storage.removeItem(key);return storage.getItem(key)===null;}catch{return false;}
}
export function importGuestWizard(storage,owner){
  if(!owner)return false;
  const ownerKey=keyFor(owner,null),guestKey=keyFor(null,null);
  let raw,existing;
  try{existing=storage.getItem(ownerKey);raw=storage.getItem(guestKey);}catch{return false;}
  if(!raw)return existing===null;
  let record;try{record=JSON.parse(raw);}catch{return false;}
  if(record?.version!==1||record.owner_id!==null||record.campaign_id!==null||!record.setup||typeof record.setup!=="object")return false;
  if(existing!==null){
    // A previous import may have saved the owner copy before guest cleanup failed.
    // Retry cleanup only for the exact matching draft; never overwrite an owner draft.
    let saved;try{saved=JSON.parse(existing);}catch{return false;}
    if(saved?.version!==1||saved.owner_id!==owner||saved.campaign_id!==null||!saved.setup||typeof saved.setup!=="object")return false;
    try{
      if(JSON.stringify(campaignSetupPayload(saved.setup,saved.setup.draft_step))!==JSON.stringify(campaignSetupPayload(record.setup,record.setup.draft_step)))return false;
    }catch{return false;}
  }else if(!rememberWizard(storage,owner,null,record.setup))return false;
  try{
    // A storage race or silent write must not authorize removal of a different draft.
    if(storage.getItem(guestKey)!==raw)return false;
    storage.removeItem(guestKey);
    return storage.getItem(guestKey)===null;
  }catch{return false;}
}
export function withStoryVersion(setup,story,now=()=>new Date().toISOString()){
  if(typeof story!=="string"||!story.trim()||setup.story_versions?.at(-1)?.text===story)return setup;
  return {...setup,story_versions:campaignSetupPayload({...setup,story_versions:[...(setup.story_versions||[]),{text:story,saved_at:now()}]},setup.draft_step).story_versions};
}
