import {SCOUT_PUBLIC_FEEDS,scoutParsePublicRss,scoutFilterLeads} from "../../../src/lib/scoutFeeds.mjs";
// Public, bounded, read-only official-source research. No account data, no
// third-party login, no attribution, no application, no payouts and no scraping
// of authenticated publisher dashboards.
const json=(body,status=200)=>Response.json(body,{status,headers:{"cache-control":"public, max-age=300","x-content-type-options":"nosniff"}});
async function readCapped(response,cap=500000) {
 const size=Number(response.headers.get("content-length")||0);
 if(size>cap)return null;
 const reader=response.body?.getReader();
 if(!reader)return null;
 const chunks=[];let total=0;
 try {
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>cap){await reader.cancel().catch(()=>{});return null;}
   chunks.push(value);
  }
  const data=new Uint8Array(total);let offset=0;
  for(const c of chunks){data.set(c,offset);offset+=c.byteLength;}
  return new TextDecoder().decode(data);
 } finally{reader.releaseLock();}
}
export async function onRequest({request,fetch:fetchOverride}) {
 if(request.method!=="GET")return json({error:"Method not allowed"},405);
 const url=new URL(request.url);
 const q=String(url.searchParams.get("q")||"");
 if(q.length>100||/[\u0000-\u001f]/.test(q))return json({error:"Invalid search text"},400);
 const getter=typeof fetchOverride==="function"?fetchOverride:fetch;
 const results=await Promise.all(SCOUT_PUBLIC_FEEDS.map(async source=>{
  try {
   const r=await getter(source.url,{method:"GET",headers:{accept:"application/rss+xml,application/xml,text/xml"},signal:AbortSignal.timeout(6500)});
   if(!r.ok)return {source:source.name,available:false,items:[]};
   const raw=await readCapped(r);
   if(!raw)return {source:source.name,available:false,items:[]};
   return {source:source.name,available:true,items:scoutParsePublicRss(raw,source,{limit:20})};
  }catch{return {source:source.name,available:false,items:[]};}
 }));
 const seen=new Set();
 const items=scoutFilterLeads(results.flatMap(x=>x.items),q).filter(x=>{
  if(seen.has(x.url))return false;
  seen.add(x.url);return true;
 }).slice(0,30);
 if(results.every(x=>!x.available))return json({error:"Official research feeds are temporarily unavailable",leads:[],source_results:results.map(({source,available})=>({source,available}))},503);
 return json({leads:items,count:items.length,
   source_results:results.map(({source,available})=>({source,available})),
   source_status:"unreviewed_official_feed",individual_eligibility_verified:false,
   earning_opportunities_verified:false,partner_affiliation:false,
   external_actions_performed:false});
}
