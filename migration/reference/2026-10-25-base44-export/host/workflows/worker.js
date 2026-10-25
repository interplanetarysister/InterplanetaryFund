// IFund workflow migration: preserve schedule and event definitions without
// accidentally executing Base44 financial, publishing, or agent functions.
import manifest from './manifest.json' with {type:'json'};
const response=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store'}});
export default {
 async fetch(req){const u=new URL(req.url);
  if(req.method==='GET'&&u.pathname==='/health')return response({service:'ifund-workflows',alive:true,ready:false,execution:'disabled',workflow_count:manifest.workflows.length});
  if(req.method==='GET'&&u.pathname==='/v1/workflows/catalog')return response({execution:'disabled',workflows:manifest.workflows.map(w=>({name:w.name,trigger_type:w.trigger_type,cron_expression:w.cron_expression,timezone:w.timezone,events:w.events,entity_name:w.entity_name}))});
  if(u.pathname.startsWith('/v1/workflows/'))return response({error:'workflow_execution_not_ready',executed:false},503);
  return response({error:'not_found'},404);
 },
 async scheduled(event,env,ctx){console.log(JSON.stringify({service:'ifund-workflows',status:'disabled',cron:event.cron,executed:false}));}
};
