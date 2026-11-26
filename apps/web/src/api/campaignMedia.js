// Cover-image bytes go to canonical Cloudflare R2, never Supabase Storage.
import {isVerifiedEmailUser} from "../lib/verifiedEmailUser.js";
import {createOwnerSessionGuard} from "../lib/ownerSessionGuard.js";
import {verifyAccountLifecycle} from "../lib/accountLifecycle.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_COVER_BYTES = 5*1024*1024;
export const isVerifiedCoverOwner = user => isVerifiedEmailUser(user) && UUID.test(user.id);
const MIME=new Set(["image/png","image/jpeg","image/webp","image/avif","image/gif"]);
export function validateCoverFile(file){
  if(!file||!file.size||file.size>5*1024*1024)return "Select a cover image smaller than 5 MB.";
  return MIME.has(file.type)?"":"Choose a JPG, PNG, WebP, AVIF, or GIF image.";
}
export async function uploadCampaignCover(client,file,{fetcher=fetch,origin=globalThis.location?.origin}={}){
  if(!file||!MIME.has(file.type)||!file.size||file.size>5*1024*1024)throw Error("Choose a PNG, JPG, WEBP, AVIF, or GIF image smaller than 5 MB.");
  const before=await client.auth.getUser(),user=before.data?.user;
  if(before.error||!isVerifiedEmailUser(user)||!UUID.test(user.id))throw Error("Sign in with a confirmed, active account before uploading.");
  const scope=createOwnerSessionGuard(client.auth,user.id);
  try {
  return await scope.run(async()=>{
  const lifecycle=await verifyAccountLifecycle(client,user);if(!lifecycle.ok)throw Error(lifecycle.message);
  const session=await client.auth.getSession();
  if(session.error||session.data?.session?.user?.id!==user.id||!session.data.session.access_token)throw Error("Your account changed before uploading.");
  const base=new URL(origin);if(base.protocol!=="https:")throw Error("Secure image uploads require HTTPS.");
  const ownDigest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("");
  scope.assertActive();
  const response=await fetcher("/api/media/campaign/upload",{method:"POST",headers:{authorization:"Bearer "+session.data.session.access_token,"content-type":file.type,origin:base.origin},body:file,signal:AbortSignal.timeout(30000)});
  const payload=await response.json().catch(()=>null);
  if(response.status!==201)throw Error(payload?.error||"Could not upload the image.");
  const after=await client.auth.getUser();
  if(after.error||after.data?.user?.id!==user.id)throw Error("Your account changed. Reopen this campaign before choosing an image.");
  const url=new URL(String(payload?.url||""),base.origin);
  if(url.origin!==base.origin||url.username||url.password||url.search||url.hash||!/^\/api\/media\/campaign\/file\/[0-9a-f-]{36}\.(png|jpg|webp|gif|avif)$/i.test(url.pathname)||payload.bytes!==file.size||payload.content_type!==file.type||payload.sha256!==ownDigest)throw Error("The upload did not return a verified image link.");
  return url.href;
  });
  }finally{scope.dispose();}
}

/** Delete an unused R2 cover only after fresh owner verification. Active
 * campaign references are protected by the server and return a 409. */
export async function deleteCampaignCover(client,storedUrl,{
  fetcher=fetch,origin=globalThis.location?.origin||"https://interplanetaryfund.com"
}={}){
  const base=new URL(origin);
  const url=new URL(String(storedUrl||""),base);
  if(base.protocol!=="https:"||url.origin!==base.origin||url.search||url.hash||url.username||url.password||
    !/^\/api\/media\/campaign\/file\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|avif)$/i.test(url.pathname))
    throw Error("Select a verified iFund stored cover link.");
  const before=await client.auth.getUser(),user=before.data?.user;
  if(before.error||!isVerifiedEmailUser(user)||!UUID.test(user.id))
    throw Error("Sign in with a confirmed account to delete an image.");
  const guard=createOwnerSessionGuard(client.auth,user.id);
  try{
   return await guard.run(async()=>{
    const lifecycle=await verifyAccountLifecycle(client,user);
    if(!lifecycle.ok)throw Error(lifecycle.message);
    const session=await client.auth.getSession();
    if(session.error||session.data?.session?.user?.id!==user.id||!session.data.session.access_token)
      throw Error("Your account changed. Reopen the media library.");
    guard.assertActive();
    const result=await fetcher(url.pathname,{method:"DELETE",headers:{
      authorization:"Bearer "+session.data.session.access_token,origin:base.origin
    },signal:AbortSignal.timeout(30000)});
    const after=await client.auth.getUser();
    if(after.error||after.data?.user?.id!==user.id)
      throw Error("Your account changed. Discarded the deletion result.");
    if(!result.ok){
      const body=await result.json().catch(()=>null);
      throw Error(typeof body?.error==="string"?body.error.slice(0,300):
        "Stored image deletion could not be verified.");
    }
    if(result.status!==204)throw Error("Stored image deletion lacked an absence receipt.");
    return true;
   });
  }finally{guard.dispose();}
}
