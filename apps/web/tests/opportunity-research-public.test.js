import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/public/opportunity-sources.js";

const ENV={SUPABASE_URL:"https://ssibsfmtodgximseeqsv.supabase.co",SUPABASE_PUBLISHABLE_KEY:"test-publishable-key"};
const url="https://ifund.test/api/public/opportunity-sources";

test("public opportunity endpoint is GET-only and fails closed without canonical configuration",async()=>{
  const bad=await onRequest({request:new Request(url),env:{}});
  assert.equal(bad.status,503);
  const post=await onRequest({request:new Request(url,{method:"POST"}),env:ENV});
  assert.equal(post.status,405);
  const wrong=await onRequest({request:new Request(url),env:{SUPABASE_URL:"https://example.com",SUPABASE_PUBLISHABLE_KEY:"test"}});
  assert.equal(wrong.status,503);
});

test("research endpoint distinguishes open grants, ongoing programs and expired applications",async()=>{
  const old=globalThis.fetch;
  const paths=[];
  globalThis.fetch=async (requestUrl,options)=>{
    const u=new URL(String(requestUrl));
    paths.push(u);
    assert.equal(u.hostname,"ssibsfmtodgximseeqsv.supabase.co");
    assert.equal(options.headers.apikey,ENV.SUPABASE_PUBLISHABLE_KEY);
    if(u.pathname.endsWith("ifund_institution"))return Response.json([
      {id:"source1",name:"Provider",industry:"grants",website:"https://provider.org",description:"Research hub",verification_status:"verified",created_by_id:"should-not-leak"},
      {id:"unsafe",name:"Not HTTPS",website:"http://unsafe.example",industry:"grants"},
    ]);
    return Response.json([
      {id:"new",title:"Open grant",type:"grant",status:"open",official_url:"https://provider.org/apply",official_provider:"Provider",verified_at:"2026-11-11",deadline_date:"2026-11-30",cause_tags:["education"],created_by_id:"private"},
      {id:"old",title:"Expired grant",type:"grant",status:"open",official_url:"https://provider.org/old",verified_at:"2026-11-11",deadline_date:"2020-01-01"},
      {id:"program",title:"Volunteer program",type:"volunteer",status:"program",official_url:"https://provider.org/volunteer",verified_at:"2026-11-11",deadline_date:null},
      {id:"bad",title:"Insecure",type:"grant",status:"open",official_url:"http://provider.org/danger",verified_at:"2026-11-11"},
    ]);
  };
  try{
    const r=await onRequest({request:new Request(url),env:ENV});
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.source,"canonical_supabase_rls");
    assert.equal(body.sources.length,1);
    assert.equal(body.opportunities.length,2);
    assert.deepEqual(body.opportunities.map(x=>x.id),["new","program"]);
    assert.equal(body.opportunities[0].deadline_date,"2026-11-30");
    assert.equal(body.auto_apply_enabled,false);
    assert.equal(JSON.stringify(body).includes("created_by_id"),false);
    assert.equal(paths.length,2);
    assert(paths.every(x=>x.searchParams.get("source_system")?.startsWith("eq.ifund_")));
    assert(paths.every(x=>x.searchParams.get("select")?.includes("id")));
  }finally{globalThis.fetch=old;}
});

test("upstream failures never substitute fictional opportunities",async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>new Response("provider unavailable",{status:503});
  try{
    const r=await onRequest({request:new Request(url),env:ENV});
    assert.equal(r.status,503);
    assert(!("opportunities" in await r.json()));
  }finally{globalThis.fetch=previous;}
});
