// IFund workforce read-only catalog and readiness service.
// Never claims remote skills, memory or execution adapters are available.
import catalog from './manifest.json' with { type: 'json' };
const respond=(payload,status=200)=>Response.json(payload,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const roles=catalog.entries.filter(x=>x.source.startsWith('base44/agents/')).map(x=>({id:x.source.split('/').pop().replace('.jsonc',''),sha256:x.sha256}));
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname==='/health')return respond({service:'ifund-workforce',runtime:'cloudflare-worker',alive:true,ready:false,execution:'disabled',reason:'tool_memory_auth_adapters_unverified',agent_count:roles.length});
  if(request.method==='GET'&&url.pathname==='/v1/workforce/catalog')return respond({version:catalog.schema_version,activation:'disabled',agents:roles,skill_file_count:catalog.entries.length-roles.length,unverified:catalog.unverified});
  if(!url.pathname.startsWith('/v1/workforce/'))return respond({error:'not_found'},404);
  return respond({error:'service_unavailable',code:'workforce_not_ready',message:'Agent workforce migration is in progress; no agent action was executed.'},503);
 }
};
