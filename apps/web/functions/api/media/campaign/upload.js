// Public campaign images use the existing canonical R2 bucket. This endpoint
// never accepts private documents and is disabled until its binding is approved.
const LIMIT=5*1024*1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES={"image/png":"png","image/jpeg":"jpg","image/webp":"webp","image/gif":"gif","image/avif":"avif"};
const json=(status,value)=>Response.json(value,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export function imageSignature(bytes,type){
  if(type==="image/png")return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  if(type==="image/jpeg")return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==="image/webp")return bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  if(type==="image/gif")return bytes.length>=6&&["GIF89a","GIF87a"].includes(String.fromCharCode(...bytes.slice(0,6)));
  if(type==="image/avif")return bytes.length>=16&&String.fromCharCode(...bytes.slice(4,8))==="ftyp"&&/avif|avis/.test(String.fromCharCode(...bytes.slice(8,32)));
  return false;
}
async function bodyBytes(request){
  if(!request.body)throw Error("missing_body");
  const reader=request.body.getReader(),parts=[];let size=0;
  try{
    while(true){
      const {value,done}=await reader.read();if(done)break;
      if(!(value instanceof Uint8Array))throw Error("invalid_body");
      size+=value.byteLength;if(size>LIMIT)throw RangeError("image_too_large");parts.push(value);
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
}
async function ownerIdentity(request,env){
  const bearer=request.headers.get("authorization")||"",endpoint=env.SUPABASE_URL;
  const key=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(bearer)||endpoint!=="https://ssibsfmtodgximseeqsv.supabase.co"||!key)return null;
  const headers={apikey:key,authorization:bearer,accept:"application/json"};
  const response=await fetch(endpoint+"/auth/v1/user",{headers,signal:AbortSignal.timeout(8000)});
  if(!response.ok)return null;const user=await response.json();
  if(!UUID.test(user?.id||"")||user.is_anonymous===true||!user.email_confirmed_at)return null;
  const profile=await fetch(endpoint+"/rest/v1/ifund_profiles?select=account_status,account_deletion_pending&id=eq."+encodeURIComponent(user.id),{headers,signal:AbortSignal.timeout(8000)});
  if(!profile.ok)return null;const rows=await profile.json();
  return Array.isArray(rows)&&rows.length===1&&rows[0].account_status==="active"&&rows[0].account_deletion_pending===false?user.id:null;
}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
export async function onRequest({request,env}){
  if(request.method!=="POST")return json(405,{error:"Only POST is supported."});
  const url=new URL(request.url);
  if(url.protocol!=="https:"||request.headers.get("origin")!==url.origin)return json(403,{error:"Upload from the campaign editor on this site."});
  const bucket=env.IFUND_CAMPAIGN_MEDIA;
  if(env.IFUND_CAMPAIGN_MEDIA_ENABLED!=="enabled"||!bucket?.put||!bucket?.get||!bucket?.head)return json(503,{error:"Campaign image uploads are awaiting secure media configuration. You can use an image URL meanwhile."});
  const type=(request.headers.get("content-type")||"").toLowerCase().split(";")[0].trim();
  if(!Object.hasOwn(TYPES,type))return json(415,{error:"Choose a PNG, JPG, WEBP, AVIF, or GIF image."});
  const length=request.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)<1||Number(length)>LIMIT))return json(413,{error:"Images must be smaller than 5 MB."});
  let owner;try{owner=await ownerIdentity(request,env);}catch{return json(503,{error:"Your account could not be verified. Please retry."});}
  if(!owner)return json(401,{error:"Sign in with a confirmed, active account before uploading."});
  let bytes;try{bytes=await bodyBytes(request);}catch(error){return json(error instanceof RangeError?413:400,{error:"The image could not be read within the 5 MB limit."});}
  if(!bytes.length||!imageSignature(bytes,type))return json(415,{error:"Image bytes do not match the selected file type."});
  const file=crypto.randomUUID()+"."+TYPES[type],key="campaigns/"+owner+"/"+file;
  try{
    const sha256=await digest(bytes);
    await bucket.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:"public, max-age=86400"},customMetadata:{owner_id:owner,sha256}});
    const head=await bucket.head(key);
    if(!head||head.size!==bytes.length)throw Error("image_head_unverified");
    const saved=await bucket.get(key);
    if(!saved||saved.size!==bytes.length||typeof saved.arrayBuffer!=="function"||await digest(await saved.arrayBuffer())!==sha256)throw Error("image_bytes_unverified");
    return json(201,{url:url.origin+"/api/media/campaign/"+owner+"/"+file,content_type:type,bytes:bytes.length,sha256});
  }catch{return json(503,{error:"Image storage could not verify the saved bytes. Please retry."});}
}
