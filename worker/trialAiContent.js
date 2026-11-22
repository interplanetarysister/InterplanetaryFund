const endpoint = (env, name) => env.SUPABASE_URL + "/rest/v1/rpc/" + name;
async function invoke(env, jwt, name, payload, fetcher = fetch) {
  if (typeof env?.SUPABASE_URL !== "string" ||
      typeof env?.SUPABASE_PUBLISHABLE_KEY !== "string" ||
      typeof jwt !== "string" || !jwt) throw new Error("Verified AI allowance service unavailable.");
  const response = await fetcher(endpoint(env,name), {
    method: "POST",
    headers: {
      "apikey": env.SUPABASE_PUBLISHABLE_KEY,
      "Authorization": "Bearer " + jwt,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Your AI allowance could not be verified.");
  return response.json();
}
/** Account-level trial use is reserved before inference, completed only for
 * a validated generated item, and released on provider failures. Paid members
 * preserve their separately verified per-feature limits. */
export async function reserveTrialContent(env,jwt,kind,requestId,fetcher=fetch) {
  const data=await invoke(env,jwt,"ifund_trial_ai_generation_reserve",
    {p_request_id:requestId,p_kind:kind},fetcher);
  if (data?.state==="trial_limit") return {allowed:false,code:"trial_limit",remaining:0};
  if (data?.state==="membership_required") return {allowed:false,code:"membership_required"};
  if (data?.allowed!==true ||
      !["reserved","paid_or_admin_exempt"].includes(data.state))
    return {allowed:false,code:"unavailable"};
  return {allowed:true,tracked:data.state==="reserved",kind,requestId,remaining:data.remaining??null};
}
export async function completeTrialContent(env,jwt,receipt,fetcher=fetch) {
  if(!receipt?.tracked)return true;
  return invoke(env,jwt,"ifund_trial_ai_generation_complete",
    {p_request_id:receipt.requestId,p_kind:receipt.kind},fetcher);
}
export async function releaseTrialContent(env,jwt,receipt,fetcher=fetch) {
  if(!receipt?.tracked)return;
  try { await invoke(env,jwt,"ifund_trial_ai_generation_release",
    {p_request_id:receipt.requestId,p_kind:receipt.kind},fetcher); }
  catch { /* Reservation automatically expires after thirty minutes. */ }
}
