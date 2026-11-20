import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseMissionDollarEstimate} from "../src/api/missions.js";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("Mission budget amounts use exact integer cents",()=>{
 for(const [raw,cents] of [["0",0],["0.01",1],["19.99",1999],["100.5",10050],["9999999999.99",999999999999]])
  assert.equal(parseMissionDollarEstimate(raw),cents);
 for(const bad of ["-1","1e6","1,000","$19.99","NaN","Infinity","1.234",".99","01.00","10000000000"," "])
  assert.throws(()=>parseMissionDollarEstimate(bad),/amount|large/i);
});
test("Mission budget never writes payment ledger or invents donor funds",()=>{
 const api=read("../src/api/missions.js");
 const pane=read("../src/components/missions/MissionBudget.jsx");
 assert.match(api,/from\("ifund_mission_cost_items"\)/);
 assert.match(api,/\.eq\("owner_id",owner\)/);
 assert.match(api,/await verifiedOwner\(client,true\)/);
 assert.match(api,/await sessionStillOwner\(client,owner\)/);
 assert.doesNotMatch(pane,/donations\.insert|ifund_donations|capturePayment|payment.*create/i);
 assert.match(pane,/not verified expenses, donations, available assistance/);
 assert.match(pane,/No payment or fundraising action is triggered/);
});
test("Mission budget is a private owner-bound workspace component",()=>{
 const view=read("../src/pages/MissionWorkspace.jsx");
 assert.match(view,/import MissionBudget from/);
 assert.match(view,/<MissionBudget key=\{mission\.id\+":"\+owner\} missionId=\{mission\.id\} ownerId=\{owner\}/);
});
