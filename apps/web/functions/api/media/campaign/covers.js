// Authenticated inventory of the current member's R2 public cover receipts.
// This lists only new, owner-registered covers; legacy unregistered R2 objects
// require an independently verified migration and are never guessed at.
import {ownerIdentity} from "./upload.js";
const FILE=/^campaigns\/public\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|webp|gif|avif)$/i;
const MIME=new Set(["image/png","image/jpeg","image/webp","image/gif","image/avif"]);
const json=(status,value)=>Response.json(value,{status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
export async function onRequestGet({request,env}){
 const url=new URL(request.url);
 if(url.protocol!=="https:")return json(403,{error:"Secure media requires HTTPS."});
 if(env.IFUND_CAMPAIGN_MEDIA_ENABLED!=="enabled")return json(503,{error:"Media storage unavailable."});
 const offset=Number(url.searchParams.get("offset")||0);
 if(!Number.isSafeInteger(offset)||offset<0||offset>5000)return json(400,{error:"Invalid media list page."});
 let owner;try{owner=await ownerIdentity(request,env);}catch{return json(503,{error:"Account verification is unavailable."});}
 if(!owner)return json(401,{error:"Sign in to view saved public covers."});
 const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||env.SUPABASE_URL!=="https://ssibsfmtodgximseeqsv.supabase.co")
  return json(503,{error:"Cover inventory unavailable."});
 const headers={apikey:secret,accept:"application/json"};
 if(!secret.startsWith("sb_secret_"))headers.authorization="Bearer "+secret;
 try{
  const select="object_key,owner_id,content_type,byte_count,object_sha256,created_at";
  const query="?select="+select+"&owner_id=eq."+owner+"&deleted_at=is.null"+
   "&order=created_at.desc&limit=50&offset="+offset;
  const response=await fetch(env.SUPABASE_URL+"/rest/v1/ifund_public_cover_objects"+query,{
    headers,redirect:"error",signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)return json(503,{error:"Stored cover inventory is unavailable."});
  const rows=await response.json();
  if(!Array.isArray(rows)||rows.length>50||rows.some(row=>
    row.owner_id!==owner||!FILE.test(row.object_key||"")||!MIME.has(row.content_type)||
    !Number.isSafeInteger(row.byte_count)||row.byte_count<1||row.byte_count>5242880||
    !/^[a-f0-9]{64}$/.test(row.object_sha256||"")))
    return json(503,{error:"Stored cover inventory failed verification."});
  return json(200,{items:rows.map(row=>({
    url:url.origin+"/api/media/campaign/file/"+row.object_key.slice("campaigns/public/".length),
    content_type:row.content_type,bytes:row.byte_count,sha256:row.object_sha256,created_at:row.created_at
  })),next_offset:rows.length===50?offset+50:null});
 }catch{return json(503,{error:"Stored cover inventory cannot be read."});}
}
