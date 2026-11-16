import {campaignSetupPayload} from "../api/campaignSetup.js";
const PREFIX="ifund-campaign-wizard-v1";
export const WIZARD_STEPS=Object.freeze(["Your details","Campaign basics","Your story","Review and launch"]);
const keyFor=(owner,campaign)=>PREFIX+":"+(owner?"owner:"+encodeURIComponent(owner):"guest")+":"+encodeURIComponent(campaign||"new");
export function emptyWizard(){return campaignSetupPayload({},0);}
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
    storage.setItem(key,JSON.stringify({version:1,owner_id:owner||null,campaign_id:campaign||null,setup:campaignSetupPayload(setup,setup.draft_step)}));return true;
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
  let raw;try{
    if(storage.getItem(keyFor(owner,null)))return false;
    raw=storage.getItem(keyFor(null,null));
  }catch{return false;}
  if(!raw)return true;
  let record;try{record=JSON.parse(raw);}catch{return false;}
  if(record?.version!==1||record.owner_id!==null||record.campaign_id!==null)return false;
  if(!rememberWizard(storage,owner,null,record.setup))return false;
  try{storage.removeItem(keyFor(null,null));return storage.getItem(keyFor(null,null))===null;}catch{return false;}
}
export function withStoryVersion(setup,story,now=()=>new Date().toISOString()){
  if(typeof story!=="string"||!story.trim()||setup.story_versions?.at(-1)?.text===story)return setup;
  return {...setup,story_versions:campaignSetupPayload({...setup,story_versions:[...(setup.story_versions||[]),{text:story,saved_at:now()}]},setup.draft_step).story_versions};
}
