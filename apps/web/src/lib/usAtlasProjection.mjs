// Schematic North American map projection. The input is an organizer-approved
// approximate point only; the outline is illustrative, not for navigation.
// The mainland is intentionally plotted in longitude/latitude space, with
// separate AK/HI insets so non-contiguous American campaigns remain visible.
export const US_REGIONS=Object.freeze([
  {id:"mainland",name:"Contiguous United States",bounds:{west:-125,east:-66,south:24,north:50},view:{x:55,y:55,w:850,h:310}},
  {id:"alaska",name:"Alaska",bounds:{west:-170,east:-129,south:51,north:72},view:{x:65,y:392,w:225,h:95}},
  {id:"hawaii",name:"Hawaii",bounds:{west:-161,east:-154,south:18,north:23},view:{x:328,y:392,w:180,h:95}},
  {id:"puerto-rico",name:"Puerto Rico",bounds:{west:-67.5,east:-65.2,south:17.8,north:18.6},view:{x:562,y:392,w:260,h:95}},
]);
export function usRegionForPoint(latitude,longitude) {
  const lat=Number(latitude),lng=Number(longitude);
  if(latitude==null||longitude==null||!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  return US_REGIONS.find(r=>lat>=r.bounds.south&&lat<=r.bounds.north&&lng>=r.bounds.west&&lng<=r.bounds.east &&
    (r.id !== "mainland" || withinContiguousOutline(lat,lng)))||null;
}
// Rendering an outline is not a campaign eligibility check. Boundary vertices
// intentionally sit *on* the coastline and may fail the strict inside test.
function projectInRegion(latitude, longitude, region) {
  const {bounds:b,view:v}=region;
  return {x:v.x+((Number(longitude)-b.west)/(b.east-b.west))*v.w,
    y:v.y+((b.north-Number(latitude))/(b.north-b.south))*v.h,region:region.id};
}
export function projectUsPoint(latitude,longitude) {
  const region=usRegionForPoint(latitude,longitude);
  return region ? projectInRegion(latitude,longitude,region) : null;
}
export const CONTIGUOUS_OUTLINE=Object.freeze([
  [48.5,-124.7],[46,-124],[43,-124.4],[42,-124.3],[40,-124.3],[38,-123],[36,-121],[34.5,-120.5],[32.5,-117.1],
  [32.6,-114.7],[31.3,-111],[31.3,-108.2],[31.4,-106.5],[29.6,-104.4],[29.0,-103],[29.6,-100],
  [25.8,-97.6],[25.9,-97.2],[28,-96],[29.6,-94],[29.0,-91],[29.6,-89],[30.2,-85],[29.8,-83],[28.8,-82.8],[27.8,-82.7],[26,-82.2],[25.2,-81.2],[24.5,-82.0],[24.6,-81.2],[25.2,-79.8],
  [29,-80.5],[32,-81],[35,-75.5],[37,-76],[39,-75],[40.8,-73.8],[41.2,-71.8],[42,-70.5],
  [44,-67],[45,-71],[45.5,-73],[43,-79],[42,-82],[43,-84],[46.5,-84.8],[47,-89],[49,-95],
  [49,-110],[49,-120],[49,-123],[48.5,-124.7]
]);
export function mainlandOutlinePath(){
  return CONTIGUOUS_OUTLINE.map(([lat,lon],i)=>{
    const p=projectInRegion(lat,lon,US_REGIONS[0]);
    return (i===0?"M":"L")+p.x.toFixed(1)+" "+p.y.toFixed(1);
  }).join(" ")+" Z";
}

// This boundary is a *schematic* inclusion check, not a legal country border.
// It avoids counting obvious Canadian and Mexican positions as U.S. markers.
// Alaska and Hawaii have independent approximate insets above.
function withinContiguousOutline(lat,lng) {
  let inside=false;
  for(let i=0,j=CONTIGUOUS_OUTLINE.length-1;i<CONTIGUOUS_OUTLINE.length;j=i++) {
    const [ay,ax]=CONTIGUOUS_OUTLINE[i];
    const [by,bx]=CONTIGUOUS_OUTLINE[j];
    if(((ay>lat)!==(by>lat)) && lng < (bx-ax)*(lat-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
