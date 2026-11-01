// Recover email links sent before the independent /auth/callback route
// existed. They may return to /dashboard with Supabase tokens in the hash.
// This transforms the local route only; it never contacts an outside host.
export function legacyAuthLandingRedirect(href){
  let url;
  try{url=new URL(href);}catch{return null;}
  // Legacy email confirmation links landed only on these auth/navigation pages.
  // Device pairing (/activate?code=...), OAuth consent, and feature-specific
  // one-time codes must never be mistaken for Supabase Auth callbacks.
  const LEGACY_AUTH_LANDINGS = new Set([
    "/", "/dashboard", "/onboarding", "/login", "/register",
    "/forgot-password", "/reset-password",
  ]);
  if(!LEGACY_AUTH_LANDINGS.has(url.pathname))return null;
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
