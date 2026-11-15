import { projectUsPoint } from "./usAtlasProjection.mjs";
import { isApprovedAtlasLocation } from "./atlasLocations.mjs";

// Group exact same broad rounded coordinates to keep pins selectable.
// Never group by owner, story, donation history or inferred user location.
export function groupUSCampaignMarkers(campaigns = []) {
  const clusters=new Map();
  for(const campaign of campaigns) {
    if(campaign?.status!=="active" || !isApprovedAtlasLocation(campaign)) continue;
    const point=projectUsPoint(campaign.latitude,campaign.longitude);
    if(!point) continue;
    const key=[point.region, Number(campaign.latitude).toFixed(1), Number(campaign.longitude).toFixed(1)].join(":");
    if(!clusters.has(key)) clusters.set(key,{key,point,campaigns:[]});
    clusters.get(key).campaigns.push(campaign);
  }
  return [...clusters.values()];
}
