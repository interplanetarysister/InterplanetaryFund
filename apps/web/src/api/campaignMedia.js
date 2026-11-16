// Cover-image bytes go to canonical Cloudflare R2, never Supabase Storage.
import {isVerifiedEmailUser} from "../lib/verifiedEmailUser.js";
import {verifyAccountLifecycle} from "../lib/accountLifecycle.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME=new Set(["image/png","image/jpeg","image/webp","image/avif","image/gif"]);
export function validateCoverFile(file){
  if(!file||!file.size||file.size>5*1024*1024)return "Select a cover image smaller than 5 MB.";
  return MIME.has(file.type)?"":"Choose a JPG, PNG, WebP, AVIF, or GIF image.";
}
export async function uploadCampaignCover(client,file,{fetcher=fetch,origin=globalThis.location?.origin}={}){
  if(!file||!MIME.has(file.type)||!file.size||file.size>5*1024*1024)throw Error("Choose a PNG, JPG, WEBP, AVIF, or GIF image smaller than 5 MB.");
  const before=await client.auth.getUser(),user=before.data?.user;
  if(before.error||!isVerifiedEmailUser(user)||!UUID.test(user.id))throw Error("Sign in with a confirmed, active account before uploading.");
  const lifecycle=await verifyAccountLifecycle(client,user);if(!lifecycle.ok)throw Error(lifecycle.message);
  const session=await client.auth.getSession();
  if(session.error||session.data?.session?.user?.id!==user.id||!session.data.session.access_token)throw Error("Your account changed before uploading.");
  const base=new URL(origin);if(base.protocol!=="https:")throw Error("Secure image uploads require HTTPS.");
  const response=await fetcher("/api/media/campaign/upload",{method:"POST",headers:{authorization:"Bearer "+session.data.session.access_token,"content-type":file.type,origin:base.origin},body:file,signal:AbortSignal.timeout(30000)});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw Error(payload?.error||"Could not upload the image.");
  const after=await client.auth.getUser();
  if(after.error||after.data?.user?.id!==user.id)throw Error("Your account changed. Reopen this campaign before choosing an image.");
  const url=new URL(String(payload?.url||""),base.origin);
  if(url.origin!==base.origin||url.username||url.password||url.search||url.hash||!/^\/api\/media\/campaign\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif|avif)$/i.test(url.pathname)||url.pathname.split("/")[4]!==user.id||payload.bytes!==file.size||payload.content_type!==file.type||!/^[a-f0-9]{64}$/.test(payload.sha256||""))throw Error("The upload did not return a verified image link.");
  return url.href;
}
