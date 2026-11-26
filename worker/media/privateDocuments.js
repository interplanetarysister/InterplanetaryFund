// Same-origin private campaign document upload/download/removal on the existing R2 binding.
// Browser clients never receive R2 credentials or an object URL. Account/session,
// campaign ownership, current terms, object receipts and deletion absence are checked.
export const ORIGIN="https://ssibsfmtodgximseeqsv.supabase.co";
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(pdf|docx|xlsx|txt|md|csv)$/i;
const LIMIT=8*1024*1024, ACCOUNT_BYTES=200*1024*1024, CAMPAIGN_MAX=15, ORPHAN_AGE=86400000;
export const DOCUMENT_TYPES=Object.freeze({
 "application/pdf":"pdf",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx",
 "text/plain":"txt","text/markdown":"md","text/csv":"csv"
});
const PURPOSES=new Set(["general","budget","proof","research","planning","outreach","media"]);
const json=(status,data)=>Response.json(data,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const noCache={"cache-control":"private, no-store","x-content-type-options":"nosniff"};
export const validName=v=>typeof v==="string" && v.length>0 && v.length<=160 &&
  !/[\\/\u0000-\u001f\u007f]/.test(v) && v.trim()===v;
const keyFor=(owner,campaign,file)=>"private/campaign-documents/"+owner+"/"+campaign+"/"+file;
export const hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");
const parse=async(response,maxBytes=65536)=>{
 const raw=await response.text();
 if(raw.length>maxBytes)fail(503,"Invalid database receipt.");
 try{return raw?JSON.parse(raw):null;}catch{fail(503,"Invalid database receipt.");}
};
export async function supabase(env,fetcher,path,{method="GET",jwt=null,body,admin=false,prefer}={}){
 const key=admin?env.SUPABASE_SECRET_KEY:env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(!key||!env.SUPABASE_URL||env.SUPABASE_URL!==ORIGIN)fail(503,"Private media database is unavailable.");
 const headers={apikey:key,accept:"application/json"};
 if(jwt)headers.authorization="Bearer "+jwt;
 else if(admin&&!key.startsWith("sb_secret_"))headers.authorization="Bearer "+key;
 if(body!==undefined)headers["content-type"]="application/json";
 if(prefer)headers.prefer=prefer;
 let r;try{r=await fetcher(ORIGIN+path,{method,headers,redirect:"error",signal:AbortSignal.timeout(12000),...(body===undefined?{}:{body:JSON.stringify(body)})});}
 catch{fail(503,"Private media database could not be reached.");}
 if(!r.ok){
  if(r.status===401||r.status===403)fail(403,"Your account is not authorized for this media.");
  if(r.status===409)fail(409,"This document changed. Refresh the library and retry.");
  fail(503,"Private media database rejected the operation.");
 }
 return parse(r);
}
export async function member(request,env,fetcher){
 const bearer=request.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(bearer))fail(401,"Sign in to manage private media.");
 const jwt=bearer.slice(7);
 const user=await supabase(env,fetcher,"/auth/v1/user",{jwt});
 if(!UUID.test(user?.id||"")||user?.is_anonymous===true||!user?.email_confirmed_at)
   fail(401,"A verified member account is required.");
 const profiles=await supabase(env,fetcher,"/rest/v1/ifund_profiles?select=account_status,account_deletion_pending&id=eq."+user.id,{jwt});
 if(!Array.isArray(profiles)||profiles.length!==1||profiles[0].account_status!=="active"||profiles[0].account_deletion_pending!==false)
   fail(403,"Your iFund account must be active.");
 return {id:user.id,jwt};
}
async function ownCampaign(env,fetcher,actor,campaign,{upload=false}={}){
 const rows=await supabase(env,fetcher,"/rest/v1/ifund_campaigns?select=id,owner_id&id=eq."+campaign+"&owner_id=eq."+actor.id+"&limit=1",{jwt:actor.jwt});
 if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==campaign||rows[0].owner_id!==actor.id)
   fail(404,"Owned campaign not found.");
 if(upload){
  const permitted=await supabase(env,fetcher,"/rest/v1/rpc/ifund_campaign_document_upload_permitted",{method:"POST",jwt:actor.jwt,body:{p_campaign_id:campaign}});
  if(permitted!==true)fail(403,"Uploads are not currently permitted for this campaign.");
 }
}
async function readDoc(env,fetcher,actor,campaign,id){
 const rows=await supabase(env,fetcher,"/rest/v1/ifund_campaign_documents?select=id,owner_id,campaign_id,storage_path,file_name,media_type,file_size,object_etag,object_sha256,deletion_requested_at&owner_id=eq."+actor.id+"&campaign_id=eq."+campaign+"&id=eq."+id+"&limit=1",{jwt:actor.jwt});
 if(!Array.isArray(rows)||rows.length!==1)fail(404,"Private document not found.");
 const doc=rows[0],ext=DOCUMENT_TYPES[doc.media_type];
 if(doc.owner_id!==actor.id||doc.campaign_id!==campaign||doc.id!==id||
    doc.storage_path!==keyFor(actor.id,campaign,id+"."+ext)||!ext||doc.file_size<1||
    doc.file_size>LIMIT||!doc.object_etag||!(/^[a-f0-9]{64}$/.test(doc.object_sha256||"")))
   fail(503,"Private document identity could not be verified.");
 return doc;
}
export async function boundedBytes(request,maxBytes=LIMIT){
 const length=request.headers.get("content-length");
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)<1||Number(length)>maxBytes))fail(413,"The maximum file size is 8 MB.");
 if(!request.body)fail(400,"No file was supplied.");
 const reader=request.body.getReader(),parts=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   if(!(value instanceof Uint8Array))fail(400,"Invalid upload body.");
   total+=value.byteLength;if(total>maxBytes)fail(413,"The maximum file size is 8 MB.");
   parts.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 if(!total)fail(400,"Choose a nonempty file.");
 const bytes=new Uint8Array(total);let offset=0;
 for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 return bytes;
}
export function documentSignature(bytes,type){
 if(type==="application/pdf")return bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==="%PDF-";
 if(type.includes("officedocument"))return bytes.length>=4&&bytes[0]===80&&bytes[1]===75&&[3,5,7].includes(bytes[2]);
 if(type.startsWith("text/"))return !bytes.slice(0,Math.min(bytes.length,4096)).some(v=>v===0);
 return false;
}
function metadata(request,type){
 const raw=request.headers.get("x-ifund-document-meta")||"";
 if(!raw||raw.length>22000)fail(400,"Invalid private document details.");
 let meta;try{meta=JSON.parse(decodeURIComponent(raw));}catch{fail(400,"Invalid private document details.");}
 if(!meta||typeof meta!=="object"||Array.isArray(meta)||Object.keys(meta).some(k=>!["file_name","purpose","summary","owner_excerpt","allow_agent_use"].includes(k)))
   fail(400,"Unexpected private document details.");
 if(!validName(meta.file_name)||!meta.file_name.toLowerCase().endsWith("."+DOCUMENT_TYPES[type])||
   !PURPOSES.has(meta.purpose)||typeof meta.summary!=="string"||meta.summary.length>3000||
   typeof meta.owner_excerpt!=="string"||meta.owner_excerpt.length>4000||
   typeof meta.allow_agent_use!=="boolean"||(meta.allow_agent_use&&meta.summary.trim().length<20))
   fail(400,"Review the document name, category, and agent permission details.");
 return meta;
}
async function upload(request,env,fetcher,bucket,actor,campaign){
 const type=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 if(!Object.hasOwn(DOCUMENT_TYPES,type))fail(415,"Choose a PDF, DOCX, XLSX, TXT, Markdown, or CSV file.");
 const meta=metadata(request,type);
 await ownCampaign(env,fetcher,actor,campaign,{upload:true});
 const rows=await supabase(env,fetcher,"/rest/v1/ifund_campaign_documents?select=campaign_id,file_size&owner_id=eq."+actor.id+"&limit=500",{jwt:actor.jwt});
 if(!Array.isArray(rows)||rows.length>500)fail(503,"Private document storage limits cannot be verified.");
 if(rows.filter(x=>x.campaign_id===campaign).length>=CAMPAIGN_MAX)fail(409,"This campaign already has 15 documents.");
 if(rows.reduce((n,x)=>n+Number(x.file_size||0),0)>=ACCOUNT_BYTES)fail(409,"Your private document storage is full.");
 const quota=await supabase(env,fetcher,"/rest/v1/rpc/ifund_device_rate_limit",{
  method:"POST",admin:true,body:{p_bucket_hash:await hex(new TextEncoder().encode("ifund-private-doc-owner:"+actor.id)),p_limit:20,p_window_seconds:86400}
 });
 if(quota===false)fail(429,"Your daily private document upload limit is reached.");
 if(quota!==true)fail(503,"Private document upload allowance could not be verified.");
 const bytes=await boundedBytes(request);
 if(!documentSignature(bytes,type))fail(415,"Document bytes do not match their file type.");
 if(rows.reduce((n,x)=>n+Number(x.file_size||0),0)+bytes.length>ACCOUNT_BYTES)fail(409,"Your private document storage is full.");
 const id=crypto.randomUUID(),objectKey=keyFor(actor.id,campaign,id+"."+DOCUMENT_TYPES[type]);
 const sha=await hex(bytes);
 let created=false;
 try{
  await bucket.put(objectKey,bytes,{httpMetadata:{contentType:type,cacheControl:"private, no-store"},customMetadata:{owner_id:actor.id,campaign_id:campaign,sha256:sha}});
  created=true;
  const head=await bucket.head(objectKey),readback=await bucket.get(objectKey);
  if(!head||!readback||head.size!==bytes.length||readback.size!==bytes.length||
     typeof readback.arrayBuffer!=="function"||await hex(await readback.arrayBuffer())!==sha||
     typeof head.etag!=="string"||!head.etag)
    fail(503,"Private R2 storage could not verify the uploaded bytes.");
  let extracted="";
  if(type.startsWith("text/"))
   extracted=new TextDecoder().decode(bytes.slice(0,12000)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g," ").slice(0,6000);
  const inserted=await supabase(env,fetcher,"/rest/v1/ifund_campaign_documents?select=id,owner_id,campaign_id,object_sha256",{
   method:"POST",admin:true,prefer:"return=representation",body:{
    id,owner_id:actor.id,campaign_id:campaign,object_store:"r2",object_etag:head.etag,
    object_sha256:sha,object_verified_at:new Date().toISOString(),storage_path:objectKey,
    file_name:meta.file_name,media_type:type,file_size:bytes.length,purpose:meta.purpose,
    agent_summary:meta.summary.trim(),owner_excerpt:meta.owner_excerpt.trim(),extracted_text:extracted,
    allow_agent_use:meta.allow_agent_use
   }
  });
  if(!Array.isArray(inserted)||inserted.length!==1||inserted[0].id!==id||
    inserted[0].owner_id!==actor.id||inserted[0].campaign_id!==campaign||
    inserted[0].object_sha256!==sha)fail(503,"Uploaded document metadata was not confirmed.");
  return json(201,{id,bytes:bytes.length,content_type:type,sha256:sha});
 }catch(error){
  if(created){
   // An interrupted INSERT response is not proof the transaction failed.
   // Preserve the R2 object when a matching durable document record may exist.
   let registered;
   try{
    registered=await supabase(env,fetcher,
      "/rest/v1/ifund_campaign_documents?select=id&id=eq."+id+"&limit=1",{admin:true});
   }catch{fail(503,"Document registration is uncertain; stored bytes were retained for reviewed recovery.");}
   if(!Array.isArray(registered)||registered.length)
     fail(503,"Document receipt may already exist; stored bytes were retained.");
   try{await bucket.delete(objectKey);if(await bucket.head(objectKey))throw Error("Object still exists");}
   catch{fail(503,"Private media cleanup needs recovery. The upload was not completed.");}
  }
  throw error;
 }
}
async function download(env,fetcher,bucket,actor,campaign,id){
 await ownCampaign(env,fetcher,actor,campaign);
 const doc=await readDoc(env,fetcher,actor,campaign,id);
 if(doc.deletion_requested_at)fail(404,"Private document is awaiting deletion.");
 const object=await bucket.get(doc.storage_path);
 if(!object||object.size!==doc.file_size||object.etag!==doc.object_etag||
    object.httpMetadata?.contentType!==doc.media_type||
    object.customMetadata?.sha256!==doc.object_sha256||
    object.customMetadata?.owner_id!==actor.id)
   fail(503,"The private document object could not be verified.");
 const name=doc.file_name.replace(/[^A-Za-z0-9._ -]/g,"_").replace(/"/g,"_");
 return new Response(object.body,{status:200,headers:{...noCache,
  "content-type":doc.media_type,"content-length":String(doc.file_size),
  "content-disposition":'attachment; filename="'+name+'"',"content-security-policy":"default-src 'none'; sandbox",
  "x-ifund-document-sha256":doc.object_sha256}});
}
async function remove(env,fetcher,bucket,actor,campaign,id){
 await ownCampaign(env,fetcher,actor,campaign);
 let doc=await readDoc(env,fetcher,actor,campaign,id);
 if(!doc.deletion_requested_at){
  const marked=await supabase(env,fetcher,"/rest/v1/ifund_campaign_documents?id=eq."+id+"&owner_id=eq."+actor.id+"&campaign_id=eq."+campaign+"&deletion_requested_at=is.null&select=id,deletion_requested_at",{
   method:"PATCH",jwt:actor.jwt,prefer:"return=representation",
   body:{allow_agent_use:false,deletion_requested_at:new Date().toISOString()}
  });
  if(!Array.isArray(marked)||marked.length!==1||marked[0].id!==id||!marked[0].deletion_requested_at)
    fail(409,"Document deletion could not be scheduled. Reload and retry.");
  doc={...doc,deletion_requested_at:marked[0].deletion_requested_at};
 }
 // A pending-delete record is the durable retry handle. Never clear it before
 // R2 object absence has been observed from the bound private bucket.
 await bucket.delete(doc.storage_path);
 if(await bucket.head(doc.storage_path))fail(503,"Private file deletion could not be verified. Retry.");
 const deleted=await supabase(env,fetcher,"/rest/v1/ifund_campaign_documents?id=eq."+id+"&owner_id=eq."+actor.id+"&campaign_id=eq."+campaign+"&deletion_requested_at=not.is.null&select=id",{
  method:"DELETE",admin:true,prefer:"return=representation"
 });
 if(!Array.isArray(deleted)||deleted.length!==1||deleted[0].id!==id)
   fail(503,"File removed; its pending metadata needs a cleanup retry.");
 return new Response(null,{status:204,headers:noCache});
}
async function orphanScan(env,fetcher,bucket,actor,campaign){
 await ownCampaign(env,fetcher,actor,campaign);
 const prefix=keyFor(actor.id,campaign,"");
 const found=[],now=Date.now();let cursor;
 for(let i=0;i<5;i++){
  const data=await bucket.list({prefix,limit:100,include:["customMetadata"],...(cursor?{cursor}:{})});
  for(const object of data.objects||[]){
   const file=object.key.slice(prefix.length);
   if(!FILE.test(file)||object.customMetadata?.owner_id!==actor.id||
      object.customMetadata?.campaign_id!==campaign||!Number.isFinite(new Date(object.uploaded).getTime())||
      now-new Date(object.uploaded).getTime()<ORPHAN_AGE)continue;
   const records=await supabase(env,fetcher,"/rest/v1/ifund_campaign_documents?select=id&storage_path=eq."+encodeURIComponent(object.key)+"&limit=1",{admin:true});
   if(!Array.isArray(records))fail(503,"Private upload recovery inventory is unavailable.");
   if(records.length===0&&found.length<25)
    found.push({path:object.key,name:file,createdAt:new Date(object.uploaded).toISOString()});
  }
  if(!data.truncated)break;
  if(!data.cursor||data.cursor===cursor)fail(503,"Private upload inventory pagination failed.");
  cursor=data.cursor;
 }
 return json(200,{items:found});
}
async function orphanRemove(env,fetcher,bucket,actor,campaign,file){
 await ownCampaign(env,fetcher,actor,campaign);
 if(!FILE.test(file))fail(404,"Private upload not found.");
 const objectKey=keyFor(actor.id,campaign,file),object=await bucket.head(objectKey);
 if(!object||object.customMetadata?.owner_id!==actor.id||object.customMetadata?.campaign_id!==campaign||
    !Number.isFinite(new Date(object.uploaded).getTime())||
    Date.now()-new Date(object.uploaded).getTime()<ORPHAN_AGE)
   fail(409,"This upload is not an eligible abandoned object.");
 const records=await supabase(env,fetcher,"/rest/v1/ifund_campaign_documents?select=id&storage_path=eq."+encodeURIComponent(objectKey)+"&limit=1",{admin:true});
 if(!Array.isArray(records)||records.length)fail(409,"This file has a saved document record.");
 await bucket.delete(objectKey);
 if(await bucket.head(objectKey))fail(503,"Orphaned object absence could not be verified.");
 return new Response(null,{status:204,headers:noCache});
}
export async function routePrivateDocuments(request,env,fetcher=fetch){
 const parts=new URL(request.url).pathname.split("/").filter(Boolean);
 if(parts[0]!=="api"||parts[1]!=="media"||parts[2]!=="documents"||!UUID.test(parts[3]||"")||
    parts.length<4||parts.length>6)return json(404,{error:"Private media route not found."});
 const campaign=parts[3],action=parts[4],leaf=parts[5];
 if(env.IFUND_CAMPAIGN_MEDIA_ENABLED!=="enabled"||!env.IFUND_CAMPAIGN_MEDIA?.put||
    !env.IFUND_CAMPAIGN_MEDIA?.get||!env.IFUND_CAMPAIGN_MEDIA?.head||
    !env.IFUND_CAMPAIGN_MEDIA?.delete||!env.IFUND_CAMPAIGN_MEDIA?.list)
   return json(503,{error:"Private media storage is not connected."});
 if(["POST","DELETE"].includes(request.method)&&request.headers.get("origin")!==new URL(request.url).origin)
   return json(403,{error:"Use the iFund media controls on this site."});
 try{
  const actor=await member(request,env,fetcher),bucket=env.IFUND_CAMPAIGN_MEDIA;
  if(parts.length===4&&request.method==="POST")return await upload(request,env,fetcher,bucket,actor,campaign);
  if(parts.length===5&&action==="orphans"&&request.method==="GET")return await orphanScan(env,fetcher,bucket,actor,campaign);
  if(parts.length===6&&action==="orphans"&&request.method==="DELETE")return await orphanRemove(env,fetcher,bucket,actor,campaign,leaf);
  if(parts.length===5&&UUID.test(action||"")&&request.method==="GET")return await download(env,fetcher,bucket,actor,campaign,action);
  if(parts.length===5&&UUID.test(action||"")&&request.method==="DELETE")return await remove(env,fetcher,bucket,actor,campaign,action);
  return json(405,{error:"Method not allowed for this private media route."});
 }catch(error){
  const status=Number.isInteger(error?.status)&&error.status>=400&&error.status<=503?error.status:503;
  return json(status,{error:status===503&&!error?.status?"Private media is temporarily unavailable. Retry safely.":String(error.message).slice(0,240)});
 }
}
