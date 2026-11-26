import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupMemberAgentHistory } from "../src/lib/memberAgentHistory.mjs";

const events=[
  {event_key:"11111111-1111-4111-8111-111111111111",speaker:"agent",agent_id:"polaris",content:"Build a small budget.",recorded_at:"2026-11-26T00:01:00Z"},
  {event_key:"22222222-2222-4222-8222-222222222222",speaker:"user",agent_id:"nexus",content:"Hi Nexus",recorded_at:"2026-11-26T00:00:30Z"},
  {event_key:"33333333-3333-4333-8333-333333333333",speaker:"user",agent_id:"polaris",content:"Please analyze my situation and suggest specific, realistic next steps, potential risks, and ways to measure progress. My request: My mission",recorded_at:"2026-11-26T00:00:00Z"}
];

test("owner-scoped saved history becomes independent specialist conversations in time order",()=>{
 const grouped=groupMemberAgentHistory(events);
 assert.equal(grouped.polaris.length,2);
 assert.equal(grouped.polaris[0].kind,"user");
 assert.equal(grouped.polaris[0].text,"My mission");
 assert.equal(grouped.polaris[0].analysis,true);
 assert.equal(grouped.polaris[1].kind,"answer");
 assert.equal(grouped.polaris[1].text,"Build a small budget.");
 assert.equal(grouped.nexus.length,1);
 assert.equal(grouped.nexus[0].text,"Hi Nexus");
 assert.ok(grouped.polaris.every(m=>m.saved===true));
});
test("malformed, unsupported, and empty historical events are ignored",()=>{
 const grouped=groupMemberAgentHistory([...events,{agent_id:"admin",speaker:"agent",content:"Private ops",event_key:"aaa"},{agent_id:"story",speaker:"user",content:" ",event_key:"bbb"}]);
 assert.deepEqual(Object.keys(grouped).sort(),["nexus","polaris"]);
 assert.throws(()=>groupMemberAgentHistory(null),/Invalid team history/);
});
test("member Messaging loads real owner-scoped backend events without disabling chat when history fails",()=>{
 const ui=readFileSync(new URL("../src/components/agents/MemberAgentChat.jsx",import.meta.url),"utf8");
 assert.match(ui,/loadTeamHistory\(authClient\(\),\{limit:60\}\)/);
 assert.match(ui,/groupMemberAgentHistory\(saved\)/);
 assert.match(ui,/ownerGuard\.current!==ownerId/);
 assert.match(ui,/if \(!inFlight\.current\) setThreads\(grouped\)/);
 assert.match(ui,/You can still send a new message/);
 assert.match(ui,/Refresh history/);
});
