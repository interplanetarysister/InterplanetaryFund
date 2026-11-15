import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { US_REGIONS, projectUsPoint, usRegionForPoint, mainlandOutlinePath } from "../src/lib/usAtlasProjection.mjs";
import { groupUSCampaignMarkers } from "../src/lib/usAtlasClusters.mjs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("approved American city coordinates land in correct projections",()=>{
  const cases=[
    [47.6,-122.3,"mainland"],[40.7,-74,"mainland"],
    [25.8,-80.2,"mainland"],[61.2,-149.9,"alaska"],[21.3,-157.9,"hawaii"]
  ];
  for(const [lat,lng,region] of cases){
    const projection=projectUsPoint(lat,lng);
    assert.equal(projection?.region,region,lat+","+lng);
    const bounds=US_REGIONS.find(r=>r.id===region).view;
    assert.ok(projection.x>=bounds.x && projection.x<=bounds.x+bounds.w);
    assert.ok(projection.y>=bounds.y && projection.y<=bounds.y+bounds.h);
  }
});
test("non-American or missing coordinates never appear as American markers",()=>{
  for(const [lat,lng] of [[51.5,-0.1],[19.4,-99.1],[-33.9,151.2],[null,null],[200,10],["",""]]){
    assert.equal(projectUsPoint(lat,lng),null,JSON.stringify([lat,lng]));
    assert.equal(usRegionForPoint(lat,lng),null);
  }
});
test("the mainland has illustrative coastline geometry",()=>{
  const path=mainlandOutlinePath();
  assert.ok(path.startsWith("M"));
  assert.ok(path.endsWith("Z"));
  assert.ok((path.match(/ L/g)||[]).length>=20);
});
test("owner-safe map selections cannot outlive the authorized campaign props",()=>{
  const component=read("../src/components/atlas/USCampaignMap.jsx");
  const atlas=read("../src/pages/Atlas.jsx");
  assert.match(component,/groupUSCampaignMarkers\(campaigns\)/);
  assert.match(component,/clusters\.find\(cluster=>cluster\.key===selectedKey\)\|\|null/);
  assert.match(component,/No approved U\.S\. campaign locations yet/);
  assert.match(atlas,/mapView, setMapView\] = useState\("usa"\)/);
  assert.match(atlas,/<USCampaignMap campaigns=\{markers\}/);
  assert.match(atlas,/<CampaignGlobe campaigns=\{markers\}/);
});

test("cluster duplicate city-centre markers but exclude private or unapproved locations",()=>{
 const base={status:"active",map_opt_in:true,location:"Seattle area, Washington",latitude:47.6,longitude:-122.3};
 const grouped=groupUSCampaignMarkers([
   {...base,id:"a",title:"Community garden"},
   {...base,id:"b",title:"Emergency support"},
   {...base,id:"c",status:"draft"},
   {...base,id:"d",map_opt_in:false},
   {...base,id:"e",longitude:-122.2},
 ]);
 assert.equal(grouped.length,2);
 assert.equal(grouped[0].campaigns.length,2);
 assert.deepEqual(grouped[0].campaigns.map(c=>c.id),["a","b"]);
 assert.equal(grouped[1].campaigns[0].id,"e");
});
