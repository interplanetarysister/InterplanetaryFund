import { migrationReady, response } from "./reads.js";
const safeURL=/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i;
export async function probeIndependentBackend(env, fetcher=fetch) {
  if (!migrationReady(env) || !safeURL.test(env?.SUPABASE_URL || ""))
    return {ready:false,supabase_auth:"unconfigured",
      legacy_accounts_verified:false,finance_ready:false,workflows_ready:false};
  try {
    const upstream=await fetcher(env.SUPABASE_URL+"/auth/v1/health",{
      method:"GET",headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Accept:"application/json"},
      signal:AbortSignal.timeout(5000)
    });
    return {ready:false,supabase_auth:upstream.ok?"reachable":"unavailable",
      legacy_accounts_verified:false,finance_ready:false,workflows_ready:false};
  } catch {
    return {ready:false,supabase_auth:"unavailable",
      legacy_accounts_verified:false,finance_ready:false,workflows_ready:false};
  }
}
export async function routeIndependentHealth(request,env,fetcher=fetch) {
  if (request.method!=="GET") return response(405,{error:"Method not allowed."});
  return response(200,{service:"ifund-independent-backend",
    ...(await probeIndependentBackend(env,fetcher))});
}
