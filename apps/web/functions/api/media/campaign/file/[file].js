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
 const u=new URL(url);
 // A preview-origin cover can be attached to a production-domain campaign or
 // viewed through the www alias. Search by the opaque immutable cover path,
 // not by the current request hostname. Any match blocks destructive removal.
 const path=u.pathname;
 if(!/^\/api\/media\/campaign\/file\/[a-f0-9-]{36}\.(png|jpg|webp|gif|avif)$/i.test(path))
   throw Error("Invalid cover reference.");
 const query=new URLSearchParams({select:"id",cover_image_url:"like.*"+path,limit:"1"});
 const r=await fetcher(env.SUPABASE_URL+"/rest/v1/ifund_campaigns?"+query.toString(),{
  method:"GET",headers,redirect:"error",signal:AbortSignal.timeout(12000)
 });
 if(!r.ok)throw Error("Campaign references could not be checked.");
 const rows=await r.json();
 if(!Array.isArray(rows)||rows.length>1)throw Error("Campaign references are invalid.");
 return rows.length>0;
}
async function coverLedger(env,key){
 const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||env.SUPABASE_URL!=="https://ssibsfmtodgximseeqsv.supabase.co")
  throw Error("Cover storage receipts are unavailable.");
 const headers={apikey:secret,accept:"application/json","content-type":"application/json",
  prefer:"return=representation"};
 if(!secret.startsWith("sb_secret_"))headers.authorization="Bearer "+secret;
 const base=env.SUPABASE_URL+"/rest/v1/ifund_public_cover_objects";
 const url=base+"?select=object_key,owner_id,object_sha256,deleted_at&object_key=eq."+
  encodeURIComponent(key)+"&limit=1";
 const response=await fetch(url,{headers,redirect:"error",signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("Cover ledger could not be read.");
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length>1)throw Error("Cover ledger integrity failed.");
 return {row:rows[0]||null,base,headers};
}
async function markCoverDeleted(ledger,owner,key){
 if(!ledger.row)return;
 // Only after R2 HEAD has proven absence, erase the ledger row itself.
 // Retaining a soft-deleted FK row would permanently block auth-user erasure.
 const response=await fetch(ledger.base+"?object_key=eq."+encodeURIComponent(key)+
  "&owner_id=eq."+owner+"&select=object_key",{
    method:"DELETE",headers:ledger.headers,redirect:"error",signal:AbortSignal.timeout(12000)
  });
 if(!response.ok)throw Error("Cover deletion quota receipt was not stored.");
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length!==1||rows[0].object_key!==key)
  throw Error("Cover quota deletion receipt could not be verified.");
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
   const ledger=await coverLedger(env,key);
   if(ledger.row&&ledger.row.owner_id!==owner)
    return err(403,"The stored cover belongs to another account.");
   const object=await bucket.head(key);
   if(!object&&!ledger.row)return err(404,"Stored image no longer exists.");
   if(object){
    if(object.customMetadata?.owner_id!==owner||
      object.httpMetadata?.contentType!==TYPES[extension]||
      (ledger.row&&object.customMetadata?.sha256!==ledger.row.object_sha256))
      return err(403,"This stored image belongs to a different account or has an unverified receipt.");
    // Preserve campaign covers while they are referenced, including drafts.
    if(await referencedCover(env,url.origin+"/api/media/campaign/file/"+file))
      return err(409,"This image is still used by a campaign. Remove it from the campaign and save before deleting.");
    await bucket.delete(key);
    if(await bucket.head(key))return err(503,"The stored image could not be verified as deleted.");
   }
   // On a retry after a lost response, an absent R2 object and an existing
   // owner ledger row permit completing the quota receipt safely.
   await markCoverDeleted(ledger,owner,key);
   return new Response(null,{status:204,headers:{"cache-control":"no-store"}});
  }catch{return err(503,"Stored-image deletion could not be completed or verified.");}
 }
 try{
  const object=await bucket.get(key);
  if(!object||object.httpMetadata?.contentType!==TYPES[extension]||
     !Number.isSafeInteger(object.size)||object.size<1||object.size>5*1024*1024)return err(404,"Not found.");
  return new Response(request.method==="HEAD"?null:object.body,{headers:{
   "content-type":TYPES[extension],"content-length":String(object.size),
   "cache-control":"public, max-age=120, must-revalidate","x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; sandbox","cross-origin-resource-policy":"cross-origin"
  }});
 }catch{return err(503,"Media temporarily unavailable.");}
}
