import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { US_CITY_CENTERS, selectUSCity } from "../src/lib/usCityCenters.mjs";

test("US preset locations are unique, broad and one-decimal precision", () => {
  assert.ok(US_CITY_CENTERS.length>=20);
  const ids=new Set();
  for(const city of US_CITY_CENTERS){
    assert.equal(ids.has(city.id),false,city.id);ids.add(city.id);
    assert.ok(city.label.endsWith("area") || city.label.includes("area,") || city.label.includes("area,") || city.label.includes("area"));
    for(const [value,max] of [[city.lat,90],[city.lng,180]]){
      assert.ok(Number.isFinite(value) && Math.abs(value)<=max);
      assert.equal(Math.round(value*10),value*10);
    }
  }
  assert.equal(selectUSCity("missing-city"),null);
  assert.equal(selectUSCity("seattle").label,"Seattle area, Washington");
});
test("preset locations never silently publish or override opt-in",()=>{
  const content=readFileSync(new URL("../src/components/atlas/CampaignLocationFields.jsx",import.meta.url),"utf8");
  assert.match(content,/\{enabled && <>/);
  assert.match(content,/selectUSCity\(event.target.value\)/);
  assert.match(content,/change\("public_location_label",city.label\)/);
  assert.match(content,/change\("map_latitude",String\(city.lat\)\)/);
  assert.match(content,/change\("map_longitude",String\(city.lng\)\)/);
  assert.match(content,/Verify this is the actual region/);
});
