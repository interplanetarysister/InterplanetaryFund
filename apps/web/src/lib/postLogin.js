import { safeReturnTo } from "./safeReturnTo.js";

// Returning members keep their requested in-app destination. A new member
// without a profile completes onboarding after confirming their email.
export async function landingAfterLogin(client,requested){
  const destination=safeReturnTo(requested);
  const {data:verified,error:authError}=await client.auth.getUser();
  if(authError||!verified?.user?.id)
    throw new Error("The authentication service could not verify this session.");
  if(!verified.user.email_confirmed_at)
    throw new Error("Confirm your email address before signing in. Use the newest confirmation link.");
  if(destination!=="/dashboard")return destination;
  try{
    const {data,error}=await client.from("ifund_profiles")
      .select("id,display_name,handle").eq("id",verified.user.id).maybeSingle();
    // Profile query errors must not turn otherwise successful sign-in into
    // an authentication failure. The member can repair profile later.
    if(error)return destination;
    if(!data || (!data.display_name && !data.handle))return "/onboarding";
  }catch {
    return destination;
  }
  return destination;
}
