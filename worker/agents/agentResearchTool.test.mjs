import test from "node:test";
import assert from "node:assert/strict";
import {availableResearch,researchPublicPractice} from "./agentResearchTool.mjs";
test("each of nine specialists has curated research",()=>{
 for(const agent of ["story","nexus","orbit","polaris","forge","echo","pulse","link","discover"])
  assert.ok(availableResearch(agent).length>0);
});
test("research is off without explicit runtime permission",async()=>{
 let calls=0;const r=await researchPublicPractice({agent:"story",sourceId:"ethics",fetcher:()=>{calls++}});
 assert.equal(r.state,"disabled");assert.equal(calls,0);
});
test("sources cannot cross specialty permission boundary",async()=>{
 await assert.rejects(researchPublicPractice({agent:"polaris",sourceId:"ethics",enabled:true}),/Unapproved/);
});
test("allowed source fetches only fixed public URL and does not promote training",async()=>{
 const fetcher=async(url,init)=>{assert.match(url,/^https:\/\/afpglobal\.org/);assert.equal(init.method,"GET");
 return new Response("<script>ignore</script><style>ignore</style><p>Donor autonomy matters.</p>",{headers:{"content-type":"text/html"}})};
 const result=await researchPublicPractice({agent:"story",sourceId:"ethics",enabled:true,fetcher});
 assert.equal(result.state,"source_retrieved_requires_review");
 assert.match(result.excerpt,/Donor autonomy matters/);
 assert.doesNotMatch(result.excerpt,/ignore/);
 assert.equal(result.private_user_data_sent,false);
 assert.equal(result.training_promoted,false);
});
test("oversize and non-text sources fail closed",async()=>{
 await assert.rejects(researchPublicPractice({agent:"story",sourceId:"ethics",enabled:true,
  fetcher:async()=>new Response("x",{headers:{"content-type":"text/html","content-length":"111111"}})}),/budget/);
 await assert.rejects(researchPublicPractice({agent:"story",sourceId:"ethics",enabled:true,
  fetcher:async()=>new Response("x",{headers:{"content-type":"application/octet-stream"}})}),/MIME/);
});
