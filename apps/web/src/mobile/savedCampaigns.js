// Device-only campaign bookmarks store canonical UUIDs, never content or money.
// Storage can be disabled by iOS/Android WebView privacy settings; handle that
// without crashing public browsing or implying a bookmark was saved.
const KEY="ifund-mobile-saved-campaign-ids";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SAVED=100;
function storageAdapter(storage){
  if(storage!==undefined)return storage;
  try{return globalThis.localStorage;}catch{return null;}
}
export function savedCampaignIds(storage){
  try{
    const adapter=storageAdapter(storage);
    if(!adapter)return [];
    const value=JSON.parse(adapter.getItem(KEY)||"[]");
    return Array.isArray(value)?[...new Set(value.filter(id=>
      typeof id==="string"&&UUID.test(id)))].slice(0,MAX_SAVED):[];
  }catch{return [];}
}
export function setCampaignSaved(id,save,storage){
  if(typeof id!=="string"||!UUID.test(id))throw new TypeError("Invalid canonical campaign ID");
  const adapter=storageAdapter(storage);
  if(!adapter)throw new Error("Local saved campaigns are unavailable on this device.");
  const previous=savedCampaignIds(adapter);
  const next=save?[...new Set([...previous,id])].slice(-MAX_SAVED):
    previous.filter(candidate=>candidate!==id);
  adapter.setItem(KEY,JSON.stringify(next));
  return next.includes(id);
}
export function clearSavedCampaigns(storage){
  const adapter=storageAdapter(storage);
  if(!adapter)throw new Error("Local saved campaigns are unavailable on this device.");
  adapter.removeItem(KEY);
}
