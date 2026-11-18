import {campaignSetupPayload} from "../api/campaignSetup.js";
const PREFIX="ifund-campaign-wizard-v1";
export const WIZARD_STEPS=Object.freeze(["Campaign basics","Your story","Review and publish"]);
const keyFor=(owner,campaign)=>PREFIX+":"+(owner?"owner:"+encodeURIComponent(owner):"guest")+":"+encodeURIComponent(campaign||"new");
export function emptyWizard(){return campaignSetupPayload({},0);}
export function restoreWizard(storage,owner,campaign=null){
  const raw=storage.getItem(keyFor(owner,campaign));if(!raw)return emptyWizard();
  let record;try{record=JSON.parse(raw);}catch{return emptyWizard();}
  if(![1,2].includes(record?.version)||record.owner_id!==(owner||null)||record.campaign_id!==(campaign||null)||!record.setup||typeof record.setup!=="object")return emptyWizard();
  return campaignSetupPayload(record.version===1 ? {...record.setup, ai_profile:{...record.setup.ai_profile,writing_brief:{...record.setup.ai_profile?.writing_brief,wizard_version:1}}} : record.setup,record.setup.draft_step);
}
export function rememberWizard(storage,owner,campaign,setup){
  try{
    const key=keyFor(owner,campaign),raw=storage.getItem(key);
    if(raw){let previous;try{previous=JSON.parse(raw);}catch{return false;}
      if(![1,2].includes(previous?.version)||previous.owner_id!==(owner||null)||previous.campaign_id!==(campaign||null))return false;}
    const expected=JSON.stringify({version:2,owner_id:owner||null,campaign_id:campaign||null,setup:campaignSetupPayload(setup,setup.draft_step)});
    storage.setItem(key,expected);
    // A successful setItem call is not proof that browser storage persisted.
    return storage.getItem(key)===expected;
  }catch{return false;}
}
export function forgetWizard(storage,owner,campaign=null){
  try {
    const key=keyFor(owner,campaign),raw=storage.getItem(key);if(!raw)return true;
    let record;try{record=JSON.parse(raw);}catch{return false;}
    if(![1,2].includes(record?.version)||record.owner_id!==(owner||null)||record.campaign_id!==(campaign||null))return false;
    storage.removeItem(key);
    return storage.getItem(key)===null;
  }catch{return false;}
}
export function importGuestWizard(storage,owner){
  if(!owner)return false;
  try {
    const destination=keyFor(owner,null),source=keyFor(null,null),raw=storage.getItem(source);
    if(!raw)return !storage.getItem(destination);
    let record;try{record=JSON.parse(raw);}catch{return false;}
    if(![1,2].includes(record?.version)||record.owner_id!==null||record.campaign_id!==null)return false;
    const existing=storage.getItem(destination);
    if(existing) {
      // An earlier explicit import may have copied the setup but failed to
      // remove the guest source. Retry only for an identical owner copy.
      let parsed;try{parsed=JSON.parse(existing);}catch{return false;}
      if(![1,2].includes(parsed?.version)||parsed.owner_id!==owner||parsed.campaign_id!==null)return false;
      const expected=campaignSetupPayload(record.setup,record.setup.draft_step);
      if(JSON.stringify(parsed.setup)!==JSON.stringify(expected))return false;
    }else if(!rememberWizard(storage,owner,null,record.setup))return false;
    // Do not remove an overwritten guest record or claim unverified cleanup.
    if(storage.getItem(source)!==raw)return false;
    storage.removeItem(source);
    return storage.getItem(source)===null && Boolean(storage.getItem(destination));
  }catch{return false;}
}
export function withStoryVersion(setup,story,now=()=>new Date().toISOString()){
  if(typeof story!=="string"||!story.trim()||setup.story_versions?.at(-1)?.text===story)return setup;
  return {...setup,story_versions:campaignSetupPayload({...setup,story_versions:[...(setup.story_versions||[]),{text:story,saved_at:now()}]},setup.draft_step).story_versions};
}
