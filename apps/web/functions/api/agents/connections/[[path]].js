export async function onRequest({request,env}){
 if(!env.IFUND_CONNECTIONS_AGENT)return Response.json({error:'Connection assistance is not available yet.'},{status:503,headers:{'cache-control':'no-store'}});
 return env.IFUND_CONNECTIONS_AGENT.fetch(request);
}
