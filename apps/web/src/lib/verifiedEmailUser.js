// IFund password-account access requires a provider-confirmed email.
// A local session is only a hint; member access requires a server-confirmed user.
export function isVerifiedEmailUser(user) {
  return Boolean(user && typeof user.id === "string" && user.id && user.email_confirmed_at);
}

export async function resolveVerifiedEmailUser(auth) {
  const {data:sessionData,error:sessionError}=await auth.getSession();
  if(sessionError)throw sessionError;
  if(!sessionData?.session)return null;
  const {data,error}=await auth.getUser();
  if(error)throw error;
  return isVerifiedEmailUser(data?.user)?data.user:null;
}
