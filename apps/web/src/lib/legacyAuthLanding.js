// Recover email links sent before the independent /auth/callback route
// existed. They may return to /dashboard with Supabase tokens in the hash.
// This transforms the local route only; it never contacts an outside host.
export function legacyAuthLandingRedirect(href){
  let url;
  try{url=new URL(href);}catch{return null;}
  if(url.pathname==="/auth/callback")return null;
  if(url.protocol!=="https:" && !(url.protocol==="http:"&&url.hostname==="localhost"))
    return null;
  const hash=new URLSearchParams(url.hash.replace(/^#/,""));
  const code=url.searchParams.get("code");
  const token_hash=url.searchParams.get("token_hash");
  const isHashSession=Boolean(hash.get("access_token")||hash.get("refresh_token"));
  const isAuthError=Boolean(hash.get("error")||url.searchParams.get("error"));
  if(!isHashSession && !code && !token_hash && !isAuthError)return null;
  const recovery=hash.get("type")==="recovery" || url.searchParams.get("type")==="recovery";
  const next=recovery?"/reset-password":"/onboarding";
  const query=new URLSearchParams({next});
  for(const field of ["code","token_hash","type","error","error_description"])
    if(url.searchParams.has(field))query.set(field,url.searchParams.get(field));
  return "/auth/callback?"+query.toString()+url.hash;
}
