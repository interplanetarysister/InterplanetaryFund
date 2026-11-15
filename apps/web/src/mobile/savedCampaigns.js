// Personal on-device bookmarks. IDs alone are stored and re-resolved from
// live RLS-visible IFund campaigns; private stories/ledger never go offline.
const KEY = "ifund-mobile-saved-campaign-ids";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SAVED = 100;
export function savedCampaignIds(storage=globalThis.localStorage){
  try {
    const value=JSON.parse(storage.getItem(KEY)||"[]");
    return Array.isArray(value)?[...new Set(value.filter(id=>typeof id==="string"&&UUID.test(id)))].slice(0,MAX_SAVED):[];
  } catch { return []; }
}
export function setCampaignSaved(id,save,storage=globalThis.localStorage){
  if(typeof id!=="string"||!UUID.test(id))throw new TypeError("Invalid canonical campaign ID");
  const previous=savedCampaignIds(storage);
  const next=save?[...new Set([...previous,id])].slice(-MAX_SAVED):previous.filter(x=>x!==id);
  storage.setItem(KEY,JSON.stringify(next));
  return next.includes(id);
}
export function clearSavedCampaigns(storage=globalThis.localStorage) {
  storage.removeItem(KEY);
}
