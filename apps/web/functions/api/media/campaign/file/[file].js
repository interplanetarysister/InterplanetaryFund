import {ownerIdentity} from "../upload.js";
// Public image bytes may be served without login. Deleting a stored cover
// requires the uploader's verified account and proof that no campaign uses it.
const FILE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|avif)$/i;
const TYPES={png:"image/png",jpg:"image/jpeg",webp:"image/webp",gif:"image/gif",avif:"image/avif"};
const err=(code,message)=>Response.json({error:message},{status:code,headers:{"cache-control":"no-store"}});
async function referencedCover(env,url,fetcher=fetch){
 const key=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key||!env.SUPABASE_URL||env.SUPABASE_URL!=="https://ssibsfmtodgximseeqsv.supabase.co")
   throw Error("Cover references cannot be checked.");
 const headers={apikey:key,accept:"application/json"};
 if(!key.startsWith("sb_secret_"))headers.authorization="Bearer "+key;
 const filter=encodeURIComponent(url);
 const r=await fetcher(env.SUPABASE_URL+"/rest/v1/ifund_campaigns?select=id&cover_image_url=eq."+filter+"&limit=1",{
  method:"GET",headers,redirect:"error",signal:AbortSignal.timeout(12000)
 });
 if(!r.ok)throw Error("Campaign references could not be checked.");
 const rows=await r.json();
 if(!Array.isArray(rows)||rows.length>1)throw Error("Campaign references are invalid.");
 return rows.length>0;
}
export async function onRequest({request,env,params}){
 if(!["GET","HEAD","DELETE"].includes(request.method))return err(405,"Method not allowed.");
 const file=String(params.file||""),extension=file.match(FILE)?.[1]?.toLowerCase();
 if(!extension)return err(404,"Not found.");
 if(env.IFUND_CAMPAIGN_MEDIA_ENABLED!=="enabled"||
    !env.IFUND_CAMPAIGN_MEDIA?.get)return err(503,"Media unavailable.");
 const bucket=env.IFUND_CAMPAIGN_MEDIA,key="campaigns/public/"+file;
 if(request.method==="DELETE"){
  const url=new URL(request.url);
  if(request.headers.get("origin")!==url.origin)return err(403,"Delete from the iFund media controls.");
  if(!bucket.head||!bucket.delete)return err(503,"Media deletion is not configured.");
  let owner;try{owner=await ownerIdentity(request,env);}catch{return err(503,"Account verification is unavailable.");}
  if(!owner)return err(401,"Sign in to remove a stored image.");
  try{
   const object=await bucket.head(key);
   if(!object)return err(404,"Stored image no longer exists.");
   if(object.customMetadata?.owner_id!==owner||
      object.httpMetadata?.contentType!==TYPES[extension])
     return err(403,"This stored image belongs to a different account.");
   // Published and draft campaigns retain their image links until the owner
   // explicitly removes or replaces them. Never break an active campaign.
   if(await referencedCover(env,url.origin+"/api/media/campaign/file/"+file))
     return err(409,"This image is still used by a campaign. Remove it from the campaign and save before deleting.");
   await bucket.delete(key);
   if(await bucket.head(key))return err(503,"The stored image could not be verified as deleted.");
   return new Response(null,{status:204,headers:{"cache-control":"no-store"}});
  }catch{return err(503,"Stored-image deletion could not be completed or verified.");}
 }
 try{
  const object=await bucket.get(key);
  if(!object||object.httpMetadata?.contentType!==TYPES[extension]||
     !Number.isSafeInteger(object.size)||object.size<1||object.size>5*1024*1024)return err(404,"Not found.");
  return new Response(request.method==="HEAD"?null:object.body,{headers:{
   "content-type":TYPES[extension],"content-length":String(object.size),
   "cache-control":"public, max-age=86400","x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; sandbox","cross-origin-resource-policy":"cross-origin"
  }});
 }catch{return err(503,"Media temporarily unavailable.");}
}
