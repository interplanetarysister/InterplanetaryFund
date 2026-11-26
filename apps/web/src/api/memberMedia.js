// Browser adapter for private Cloudflare R2 member media. No R2 keys in JS.
import {isVerifiedEmailUser} from "../lib/verifiedEmailUser.js";
import {verifyAccountLifecycle} from "../lib/accountLifecycle.js";
import {createOwnerSessionGuard} from "../lib/ownerSessionGuard.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LIBRARY_MIME=Object.freeze({
 "image/png":["image","png",5242880],"image/jpeg":["image","jpg",5242880],
 "image/webp":["image","webp",5242880],"image/gif":["image","gif",5242880],
 "video/mp4":["video","mp4",41943040],"video/webm":["video","webm",41943040],
 "audio/mpeg":["audio","mp3",16777216],"audio/wav":["audio","wav",16777216],
 "audio/ogg":["audio","ogg",16777216],"audio/mp4":["audio","m4a",16777216]
});
const UUID_FILE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|mp4|webm|mp3|wav|ogg|m4a)$/i;
export function validateLibraryFile(file){
 const rule=LIBRARY_MIME[file?.type];
 if(!file||!rule)return "Choose a supported JPG, PNG, WebP, GIF, MP4, WebM, MP3, WAV, OGG or M4A file.";
 if(!file.size||file.size>rule[2])return "Images: 5 MB maximum; audio: 16 MB; video: 40 MB.";
 if(!file.name||file.name.length>160||/[\\/\u0000-\u001f\u007f]/.test(file.name)||!(file.name.toLowerCase().endsWith("."+rule[1])||(file.type==="image/jpeg"&&file.name.toLowerCase().endsWith(".jpeg"))))
   return "Use a valid file name and extension matching the chosen media format.";
 return "";
}
async function withMember(client,work){
 const before=await client.auth.getUser(),user=before.data?.user;
 if(before.error||!isVerifiedEmailUser(user)||!UUID.test(user?.id||""))
  throw Error("Sign in with a confirmed email account to manage uploaded media.");
 const guard=createOwnerSessionGuard(client.auth,user.id);
 try{return await guard.run(async()=>{
  const status=await verifyAccountLifecycle(client,user);
  if(!status.ok)throw Error(status.message);
  const session=await client.auth.getSession();
  if(session.error||session.data?.session?.user?.id!==user.id||!session.data.session.access_token)
   throw Error("Your media session could not be confirmed.");
  guard.assertActive();
  const result=await work({ownerId:user.id,token:session.data.session.access_token,guard});
  guard.assertActive();
  const after=await client.auth.getUser();
  if(after.error||after.data?.user?.id!==user.id)throw Error("Your account changed during the media request.");
  return result;
 });}finally{guard.dispose();}
}
async function requestMedia(fetcher,method,path,token,{file,headers={},origin=globalThis.location?.origin||"https://interplanetaryfund.com"}={}){
 const reqHeaders={authorization:"Bearer "+token,...headers};
 if(["POST","DELETE"].includes(method))reqHeaders.origin=new URL(origin).origin;
 const response=await fetcher(path,{method,headers:reqHeaders,...(file?{body:file}:{}),
  signal:AbortSignal.timeout(method==="POST"?90000:35000)});
 if(!response.ok){
  const body=await response.json().catch(()=>null);
  throw Error(typeof body?.error==="string"?body.error.slice(0,280):"Private media service is unavailable.");
 }
 return response;
}
function verifiedRow(row,owner){
 return row&&UUID.test(row.id||"")&&row.owner_id===owner&&
  Object.hasOwn(LIBRARY_MIME,row.content_type)&&
  row.content_kind===LIBRARY_MIME[row.content_type][0]&&
  row.file_size>=1&&row.file_size<=LIBRARY_MIME[row.content_type][2]&&
  /^[a-f0-9]{64}$/.test(row.object_sha256||"")&&
  typeof row.file_name==="string"&&row.file_name.length<=160;
}
export async function listMyMedia(client,{fetcher=fetch}={}){
 return withMember(client,async({ownerId,token})=>{
  const response=await requestMedia(fetcher,"GET","/api/media/library",token);
  const data=await response.json();
  if(!Array.isArray(data?.items)||data.items.length>50||data.items.some(item=>!verifiedRow(item,ownerId)))
   throw Error("The media list could not be verified for your account.");
  return data.items;
 });
}
export async function uploadMyMedia(client,file,{fetcher=fetch}={}){
 const error=validateLibraryFile(file);if(error)throw Error(error);
 return withMember(client,async({token})=>{
  const r=await requestMedia(fetcher,"POST","/api/media/library",token,{
   file,headers:{"content-type":file.type,"x-ifund-file-name":encodeURIComponent(file.name)}
  });
  if(r.status!==201)throw Error("Media upload did not return the required receipt.");
  const data=await r.json().catch(()=>null);
  if(!UUID.test(data?.id||"")||data.type!==file.type||data.size!==file.size||
   data.kind!==LIBRARY_MIME[file.type][0]||!/^[a-f0-9]{64}$/.test(data.sha256||""))
   throw Error("Uploaded media receipt was invalid.");
  return data;
 });
}
export async function downloadMyMedia(client,item,{fetcher=fetch}={}){
 return withMember(client,async({ownerId,token})=>{
  if(!verifiedRow(item,ownerId)||item.deletion_requested_at)throw Error("Choose your own active media file.");
  const response=await requestMedia(fetcher,"GET","/api/media/library/file/"+item.id,token);
  const blob=await response.blob();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await blob.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("");
  if(blob.size!==item.file_size||response.headers.get("content-type")!==item.content_type||
   digest!==item.object_sha256||response.headers.get("x-ifund-media-sha256")!==digest)
   throw Error("Downloaded media failed integrity verification.");
  return blob;
 });
}
export async function deleteMyMedia(client,item,{fetcher=fetch}={}){
 return withMember(client,async({ownerId,token})=>{
  if(!verifiedRow(item,ownerId))throw Error("Choose a verified file from your media library.");
  const response=await requestMedia(fetcher,"DELETE","/api/media/library/file/"+item.id,token);
  if(response.status!==204)throw Error("Media deletion did not return verified R2 absence.");
  return true;
 });
}
export async function listIncompleteMedia(client,{fetcher=fetch}={}){
 return withMember(client,async({ownerId,token})=>{
  const response=await requestMedia(fetcher,"GET","/api/media/library/orphans",token);
  const data=await response.json().catch(()=>null);
  const prefix="private/member-media/"+ownerId+"/";
  if(!Array.isArray(data?.items)||data.items.length>25||data.items.some(row=>
   typeof row.path!=="string"||!row.path.startsWith(prefix)||
   !UUID_FILE.test(row.path.slice(prefix.length))||
   row.name!==row.path.slice(prefix.length)||!Number.isFinite(Date.parse(row.createdAt||""))))
   throw Error("Incomplete media inventory failed validation.");
  return data.items;
 });
}
export async function removeIncompleteMedia(client,item,{fetcher=fetch}={}){
 return withMember(client,async({ownerId,token})=>{
  const prefix="private/member-media/"+ownerId+"/";
  if(typeof item?.path!=="string"||!item.path.startsWith(prefix)||
   !UUID_FILE.test(item.path.slice(prefix.length)))
   throw Error("Only your own incomplete files may be removed.");
  const response=await requestMedia(fetcher,"DELETE","/api/media/library/orphans/"+item.path.slice(prefix.length),token);
  if(response.status!==204)throw Error("Incomplete media cleanup was not verified.");
  return true;
 });
}

// Explicit owner-only batch cleanup, for removing private files before account
// deletion. Each server request is independently authenticated and capped at
// ten verified object removals. Never report success while any media remain.
export async function deleteAllMyMedia(client,{fetcher=fetch}={}){
 return withMember(client,async({token,guard})=>{
  let removed=0;
  for(let page=0;page<6;page++){
   guard.assertActive();
   const response=await requestMedia(fetcher,"DELETE","/api/media/library/all",token);
   const data=await response.json().catch(()=>null);
   if(!Number.isSafeInteger(data?.removed)||data.removed<0||data.removed>10||
      !Number.isSafeInteger(data.remaining)||data.remaining<0||data.remaining>50)
     throw Error("The server could not verify the batch media deletion.");
   removed+=data.removed;
   if(data.remaining===0)return removed;
   if(data.removed===0)throw Error("Some saved media could not be deleted. Retry after resolving the pending file.");
  }
  throw Error("Media cleanup requires another verified batch. Refresh your library.");
 });
}
