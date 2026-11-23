// Public allowlisted professional research; no user text or private records leave iFund.
import {TEAM_CONTEXT_AGENTS,redactTeamCredentials} from "./teamContext.js";
const REFS=Object.freeze({
 ethics:{url:"https://afpglobal.org/ethics/code-ethical-standards",agents:["nexus","story","orbit","echo","pulse"]},
 transparency:{url:"https://afpglobal.org/nonprofit-first-considerations-platforms-enabling-charitable-donations",agents:["link","forge","orbit","nexus"]},
 planning:{url:"https://learning.candid.org/introduction-to-fundraising-planning/320696",agents:["polaris","story","discover","pulse"]},
 outreach:{url:"https://www.councilofnonprofits.org/running-nonprofit/fundraising-and-resource-development/ethical-fundraising",agents:["echo","pulse","link","discover"]}
});
export const RESEARCH_VERSION="2026-11-20-v1";
export function availableResearch(agent){
 if(!TEAM_CONTEXT_AGENTS.includes(agent))throw Error("Unknown specialist");
 return Object.entries(REFS).filter(([,s])=>s.agents.includes(agent)).map(([id,s])=>({id,url:s.url}));
}
export async function researchPublicPractice({agent,sourceId,enabled=false,fetcher=fetch}={}){
 if(!TEAM_CONTEXT_AGENTS.includes(agent))throw Error("Unknown specialist");
 if(!enabled)return {state:"disabled"};
 const source=REFS[sourceId];if(!source||!source.agents.includes(agent))throw Error("Unapproved research source");
 const url=new URL(source.url);
 if(url.protocol!=="https:"||!["afpglobal.org","learning.candid.org","www.councilofnonprofits.org"].includes(url.hostname))
  throw Error("Research origin not allowlisted");
 const res=await fetcher(url.href,{method:"GET",redirect:"error",headers:{accept:"text/html,text/plain"},signal:AbortSignal.timeout(7000)});
 if(!res.ok||res.status>=300)throw Error("Professional source unavailable");
 const type=(res.headers.get("content-type")||"").toLowerCase();
 if(!type.includes("text/html")&&!type.includes("text/plain"))throw Error("Research MIME rejected");
 if(Number(res.headers.get("content-length")||0)>110000)throw Error("Research size budget exceeded");
 if(!res.body?.getReader)throw Error("Streaming reader required");
 const reader=res.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>110000)throw Error("Research size budget exceeded");chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const excerpt=redactTeamCredentials(new TextDecoder().decode(bytes)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()).slice(0,3200);
 return {state:"source_retrieved_requires_review",agent,url:url.href,sourceId,
  excerpt,version:RESEARCH_VERSION,private_user_data_sent:false,
  external_actions:false,training_promoted:false,trust:"untrusted_public_source"};
}
