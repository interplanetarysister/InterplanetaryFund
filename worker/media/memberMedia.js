// Member-only image/audio/video library stored in the existing iFund R2 bucket.
// No public URLs or client-side service credentials. Metadata cannot be edited
// by users outside the controlled, owner-authenticated upload/deletion paths.
import {UUID,fail,supabase,member,boundedBytes,hex,validName} from "./privateDocuments.js";
const MAX_FILES=50, MAX_TOTAL=268435456, MIME=Object.freeze({
 "image/png":["image","png",5242880],
 "image/jpeg":["image","jpg",5242880],
 "image/webp":["image","webp",5242880],
 "image/gif":["image","gif",5242880],
 "video/mp4":["video","mp4",41943040],
 "video/webm":["video","webm",41943040],
 "audio/mpeg":["audio","mp3",16777216],
 "audio/wav":["audio","wav",16777216],
 "audio/ogg":["audio","ogg",16777216],
 "audio/mp4":["audio","m4a",16777216]
});
const FILE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|mp4|webm|mp3|wav|ogg|m4a)$/i;
const PREFIX="private/member-media/";
const json=(status,data)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
const keyFor=(owner,id,ext)=>PREFIX+owner+"/"+id+"."+ext;
const noStore={"cache-control":"private, no-store","x-content-type-options":"nosniff"};
export function memberMediaSignature(bytes,type){
 const s=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 if(type==="image/png")return bytes.length>8&&s(0,8)==="\x89PNG\r\n\x1a\n";
 if(type==="image/jpeg")return bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==="image/webp")return bytes.length>12&&s(0,4)==="RIFF"&&s(8,12)==="WEBP";
 if(type==="image/gif")return bytes.length>6&&["GIF87a","GIF89a"].includes(s(0,6));
 if(type==="video/mp4"||type==="audio/mp4")return bytes.length>12&&s(4,8)==="ftyp";
 if(type==="video/webm")return bytes.length>4&&bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163;
 if(type==="audio/mpeg")return bytes.length>4&&(s(0,3)==="ID3"||(bytes[0]===255&&(bytes[1]&224)===224));
 if(type==="audio/wav")return bytes.length>12&&s(0,4)==="RIFF"&&s(8,12)==="WAVE";
 if(type==="audio/ogg")return bytes.length>4&&s(0,4)==="OggS";
 return false;
}
async function memberRows(env,fetcher,actor,select){
 const rows=await supabase(env,fetcher,"/rest/v1/ifund_member_media?select="+select+"&owner_id=eq."+actor.id+"&order=created_at.desc&limit=100",{jwt:actor.jwt});
 if(!Array.isArray(rows)||rows.length>100||rows.some(x=>x.owner_id!==actor.id))fail(503,"Media inventory could not be verified.");
 return rows;
}
async function record(env,fetcher,actor,id){
 const rows=await supabase(env,fetcher,"/rest/v1/ifund_member_media?select=id,owner_id,content_kind,content_type,file_name,file_size,object_path,object_etag,object_sha256,deletion_requested_at&owner_id=eq."+actor.id+"&id=eq."+id+"&limit=1",{jwt:actor.jwt});
 if(!Array.isArray(rows)||rows.length!==1)fail(404,"Owned media file not found.");
 const item=rows[0],ext=MIME[item.content_type]?.[1];
 if(item.id!==id||item.owner_id!==actor.id||!ext||
    item.content_kind!==MIME[item.content_type][0]||item.file_size<1||
    item.file_size>MIME[item.content_type][2]||
    item.object_path!==keyFor(actor.id,id,ext)||
    typeof item.object_etag!=="string"||!item.object_etag||
    !/^[a-f0-9]{64}$/.test(item.object_sha256||""))
    fail(503,"Private media identity is invalid.");
 return item;
}
async function upload(request,env,fetcher,bucket,actor){
 const type=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase(),rule=MIME[type];
 if(!rule)fail(415,"Choose a supported image, video or audio file.");
 const encoded=request.headers.get("x-ifund-file-name")||"";
 if(encoded.length<1||encoded.length>600)fail(400,"File name is invalid.");
 let name;try{name=decodeURIComponent(encoded);}catch{fail(400,"File name is invalid.");}
 if(!validName(name)||!name.toLowerCase().endsWith("."+rule[1]))fail(400,"File name or extension is invalid.");
 const permission=await supabase(env,fetcher,"/rest/v1/rpc/ifund_member_connection_allowed",{method:"POST",jwt:actor.jwt,body:{}});
 const terms=await supabase(env,fetcher,"/rest/v1/rpc/ifund_current_user_has_current_terms",{method:"POST",jwt:actor.jwt,body:{}});
 if(permission!==true||terms!==true)fail(403,"Current account permissions and terms are required.");
 const rows=await memberRows(env,fetcher,actor,"id,owner_id,file_size");
 if(rows.length>=MAX_FILES||rows.reduce((n,x)=>n+Number(x.file_size||0),0)>=MAX_TOTAL)
   fail(409,"Your media library is full.");
 const bytes=await boundedBytes(request,rule[2]);
 if(!memberMediaSignature(bytes,type))fail(415,"Media bytes do not match the declared file type.");
 if(rows.reduce((n,x)=>n+Number(x.file_size||0),0)+bytes.length>MAX_TOTAL)
   fail(409,"Your private media library has reached its size limit.");
 const id=crypto.randomUUID(),key=keyFor(actor.id,id,rule[1]),sha=await hex(bytes);
 let created=false;
 try{
  await bucket.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:"private, no-store"},
    customMetadata:{owner_id:actor.id,sha256:sha,kind:rule[0]}});
  created=true;
  const head=await bucket.head(key),saved=await bucket.get(key);
  if(!head||!saved||head.size!==bytes.length||saved.size!==bytes.length||
     typeof head.etag!=="string"||!head.etag||typeof saved.arrayBuffer!=="function"||
     await hex(await saved.arrayBuffer())!==sha)
    fail(503,"Uploaded R2 media bytes could not be verified.");
  const stored=await supabase(env,fetcher,"/rest/v1/ifund_member_media?select=id,owner_id,object_sha256",{
   method:"POST",admin:true,prefer:"return=representation",
   body:{id,owner_id:actor.id,content_kind:rule[0],content_type:type,file_name:name,
    file_size:bytes.length,object_store:"r2",object_path:key,object_etag:head.etag,
    object_sha256:sha,object_verified_at:new Date().toISOString()}
  });
  if(!Array.isArray(stored)||stored.length!==1||stored[0].id!==id||
     stored[0].owner_id!==actor.id||stored[0].object_sha256!==sha)
    fail(503,"Private media metadata could not be verified.");
  return json(201,{id,name,kind:rule[0],type,size:bytes.length,sha256:sha});
 }catch(error){
  if(created){
   try{await bucket.delete(key);if(await bucket.head(key))fail(503,"Unregistered media needs recovery.");}
   catch{fail(503,"Private upload cleanup requires recovery. Retry later.");}
  }
  throw error;
 }
}
async function download(env,fetcher,bucket,actor,id){
 const item=await record(env,fetcher,actor,id);
 if(item.deletion_requested_at)fail(404,"This media file is awaiting removal.");
 const object=await bucket.get(item.object_path);
 if(!object||object.size!==item.file_size||object.etag!==item.object_etag||
   object.httpMetadata?.contentType!==item.content_type||
   object.customMetadata?.owner_id!==actor.id||
   object.customMetadata?.sha256!==item.object_sha256)
    fail(503,"Private media storage receipt could not be verified.");
 return new Response(object.body,{status:200,headers:{...noStore,
   "content-type":item.content_type,
   "content-length":String(item.file_size),"content-security-policy":"default-src 'none'; sandbox",
   "x-ifund-media-sha256":item.object_sha256}});
}
async function remove(env,fetcher,bucket,actor,id){
 let item=await record(env,fetcher,actor,id);
 if(!item.deletion_requested_at){
  const marked=await supabase(env,fetcher,"/rest/v1/ifund_member_media?id=eq."+id+"&owner_id=eq."+actor.id+"&deletion_requested_at=is.null&select=id,deletion_requested_at",{
   method:"PATCH",admin:true,prefer:"return=representation",
   body:{deletion_requested_at:new Date().toISOString()}
  });
  if(!Array.isArray(marked)||marked.length!==1||marked[0].id!==id||!marked[0].deletion_requested_at)
    fail(409,"Media deletion was not scheduled. Retry.");
 }
 await bucket.delete(item.object_path);
 if(await bucket.head(item.object_path))fail(503,"Media bytes are still present. Retry deletion.");
 const done=await supabase(env,fetcher,"/rest/v1/ifund_member_media?id=eq."+id+"&owner_id=eq."+actor.id+"&deletion_requested_at=not.is.null&select=id",{
  method:"DELETE",admin:true,prefer:"return=representation"
 });
 if(!Array.isArray(done)||done.length!==1||done[0].id!==id)
   fail(503,"Media object was removed; its pending metadata needs cleanup.");
 return new Response(null,{status:204,headers:noStore});
}
async function orphanScan(env,fetcher,bucket,actor){
 const prefix=PREFIX+actor.id+"/",now=Date.now(),found=[];let cursor;
 for(let page=0;page<5;page++){
  const data=await bucket.list({prefix,include:["customMetadata"],limit:100,...(cursor?{cursor}:{})});
  if(!Array.isArray(data.objects))fail(503,"Media inventory is unavailable.");
  for(const object of data.objects){
   const file=object.key.slice(prefix.length);
   if(!FILE.test(file)||object.customMetadata?.owner_id!==actor.id||
      !Number.isFinite(new Date(object.uploaded).getTime())||
      now-new Date(object.uploaded).getTime()<86400000)continue;
   const existing=await supabase(env,fetcher,"/rest/v1/ifund_member_media?select=id&object_path=eq."+encodeURIComponent(object.key)+"&limit=1",{admin:true});
   if(!Array.isArray(existing))fail(503,"Media registration status is unavailable.");
   if(!existing.length&&found.length<25)found.push({path:object.key,name:file,createdAt:new Date(object.uploaded).toISOString()});
  }
  if(!data.truncated)break;
  if(!data.cursor||data.cursor===cursor)fail(503,"Media inventory pagination failed.");
  cursor=data.cursor;
 }
 return json(200,{items:found});
}
async function orphanRemove(env,fetcher,bucket,actor,file){
 if(!FILE.test(file))fail(404,"Invalid media recovery reference.");
 const objectKey=PREFIX+actor.id+"/"+file,head=await bucket.head(objectKey);
 if(!head||head.customMetadata?.owner_id!==actor.id||
    !Number.isFinite(new Date(head.uploaded).getTime())||
    Date.now()-new Date(head.uploaded).getTime()<86400000)
    fail(409,"This file is not an eligible abandoned upload.");
 const existing=await supabase(env,fetcher,"/rest/v1/ifund_member_media?select=id&object_path=eq."+encodeURIComponent(objectKey)+"&limit=1",{admin:true});
 if(!Array.isArray(existing)||existing.length)fail(409,"This file has a saved media record.");
 await bucket.delete(objectKey);
 if(await bucket.head(objectKey))fail(503,"Abandoned file deletion was not verified.");
 return new Response(null,{status:204,headers:noStore});
}
export async function routeMemberMedia(request,env,fetcher=fetch){
 const parts=new URL(request.url).pathname.split("/").filter(Boolean);
 if(parts[0]!=="api"||parts[1]!=="media"||parts[2]!=="library"||parts.length<3||parts.length>5)
   return json(404,{error:"Media library route not found."});
 if(env.IFUND_CAMPAIGN_MEDIA_ENABLED!=="enabled"||
    !env.IFUND_CAMPAIGN_MEDIA?.put||!env.IFUND_CAMPAIGN_MEDIA?.get||
    !env.IFUND_CAMPAIGN_MEDIA?.head||!env.IFUND_CAMPAIGN_MEDIA?.delete||
    !env.IFUND_CAMPAIGN_MEDIA?.list)
   return json(503,{error:"Private R2 media library is not configured."});
 if(["POST","DELETE"].includes(request.method)&&request.headers.get("origin")!==new URL(request.url).origin)
   return json(403,{error:"Use this site's authenticated media controls."});
 try{
  const actor=await member(request,env,fetcher),bucket=env.IFUND_CAMPAIGN_MEDIA;
  if(parts.length===3&&request.method==="POST")return await upload(request,env,fetcher,bucket,actor);
  if(parts.length===3&&request.method==="GET"){
   const rows=await memberRows(env,fetcher,actor,"id,owner_id,content_kind,content_type,file_name,file_size,created_at,deletion_requested_at,object_sha256");
   return json(200,{items:rows});
  }
  if(parts.length===4&&parts[3]==="orphans"&&request.method==="GET")
   return await orphanScan(env,fetcher,bucket,actor);
  if(parts.length===5&&parts[3]==="orphans"&&request.method==="DELETE")
   return await orphanRemove(env,fetcher,bucket,actor,parts[4]);
  if(parts.length===5&&parts[3]==="file"&&UUID.test(parts[4]||"")){
   if(request.method==="GET")return await download(env,fetcher,bucket,actor,parts[4]);
   if(request.method==="DELETE")return await remove(env,fetcher,bucket,actor,parts[4]);
  }
  return json(405,{error:"Unsupported private media operation."});
 }catch(error){
  const status=Number.isInteger(error?.status)&&error.status>=400&&error.status<=503?error.status:503;
  return json(status,{error:status===503&&!error?.status?"Private media service is temporarily unavailable.":String(error.message).slice(0,240)});
 }
}
