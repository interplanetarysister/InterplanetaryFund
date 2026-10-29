import { safeReturnTo } from "./safeReturnTo.js";

const ALLOWED_TYPES=new Set(["signup","email","recovery","magiclink","invite","email_change"]);
const UNTRUSTED_MESSAGE="The verification link was invalid, expired, or already used. Request a new email and try again.";
const clean=(value)=>typeof value==="string"?value.trim():"";

// Return a fixed path so Supabase's exact redirect allowlist can be configured.
// No login credentials or tokens are put into the redirect URL we create.
export function authCallbackUrl(origin,{recovery=false}={}){
  const parsed=new URL(origin);
  if(parsed.protocol!=="https:" && !(parsed.protocol==="http:"&&parsed.hostname==="localhost"))
    throw new Error("Secure signup origin required.");
  if(parsed.username||parsed.password||parsed.search||parsed.hash)
    throw new Error("Invalid signup origin.");
  return parsed.origin+(recovery?"/auth/callback?next=/reset-password":"/auth/callback?next=/onboarding");
}

export function callbackParameters(href){
  const url=new URL(href);
  const query=url.searchParams;
  const hash=new URLSearchParams(url.hash.startsWith("#")?url.hash.slice(1):url.hash);
  const error=clean(query.get("error_description")||hash.get("error_description")||
    query.get("error")||hash.get("error"));
  const next=safeReturnTo(query.get("next")||"/onboarding");
  const code=clean(query.get("code"));
  const token_hash=clean(query.get("token_hash"));
  const token_type=clean(query.get("type"));
  const access_token=clean(hash.get("access_token"));
  const refresh_token=clean(hash.get("refresh_token"));
  if(error)return {type:"error",message:error.slice(0,180),next};
  if(code)return {type:"code",code,next};
  if(token_hash){
    if(!ALLOWED_TYPES.has(token_type))return {type:"error",message:UNTRUSTED_MESSAGE,next};
    return {type:"token_hash",token_hash,token_type,next};
  }
  if(access_token||refresh_token){
    if(!access_token||!refresh_token)return {type:"error",message:UNTRUSTED_MESSAGE,next};
    return {type:"session",access_token,refresh_token,next};
  }
  return {type:"error",message:"This link does not contain a valid verification request. Open the newest link from your email.",next};
}

// The caller erases the URL query and hash before any network exchange.
// Supabase Auth verifies every token; browser URL shape is never sufficient.
export async function completeAuthCallback(auth,params){
  if(params.type==="error")throw new Error(params.message);
  let response;
  if(params.type==="code")response=await auth.exchangeCodeForSession(params.code);
  else if(params.type==="token_hash")response=await auth.verifyOtp({
    token_hash:params.token_hash,type:params.token_type
  });
  else if(params.type==="session")response=await auth.setSession({
    access_token:params.access_token,refresh_token:params.refresh_token
  });
  else throw new Error(UNTRUSTED_MESSAGE);
  if(response?.error)throw new Error(UNTRUSTED_MESSAGE);
  const {data,error}=await auth.getUser();
  if(error||!data?.user?.id)throw new Error("The authentication service could not verify this session. Sign in again.");
  const requested=params.next==="/reset-password"?"/reset-password":"/onboarding";
  if(requested!=="/reset-password" && !data.user.email_confirmed_at)
    throw new Error("Your email confirmation is not complete. Check the newest verification email.");
  return requested;
}

// Remove all possible secrets from the browser history, before processing.
export function strippedAuthCallbackLocation(origin){
  return new URL("/auth/callback",origin).pathname;
}
