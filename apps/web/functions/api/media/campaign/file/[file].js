// New public covers use opaque keys; owner Auth IDs never appear in their URLs.
const FILE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|avif)$/i;
const TYPES={png:'image/png',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif'};
export async function onRequest({request,env,params}) {
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const file=String(params.file||''),extension=file.match(FILE)?.[1]?.toLowerCase();
 if(!extension)return new Response('Not found',{status:404});
 if(env.IFUND_CAMPAIGN_MEDIA_ENABLED!=='enabled'||!env.IFUND_CAMPAIGN_MEDIA?.get)return new Response('Media unavailable',{status:503});
 try {
  const object=await env.IFUND_CAMPAIGN_MEDIA.get('campaigns/public/'+file);
  if(!object||object.httpMetadata?.contentType!==TYPES[extension]||!Number.isSafeInteger(object.size)||object.size<1||object.size>5*1024*1024)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:object.body,{headers:{'content-type':TYPES[extension],'content-length':String(object.size),'cache-control':'public, max-age=86400','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'cross-origin-resource-policy':'cross-origin'}});
 }catch{return new Response('Media temporarily unavailable',{status:503});}
}
