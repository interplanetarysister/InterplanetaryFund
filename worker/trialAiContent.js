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
  const data=await invoke(env,jwt,"ifund_ai_content_reserve",
    {p_request_id:requestId,p_kind:kind},fetcher);
  if (data?.state==="trial_limit") return {allowed:false,code:"trial_limit",remaining:0};
  if (data?.state==="monthly_limit") return {allowed:false,code:"monthly_limit",remaining:0};
  if (data?.state==="membership_required") return {allowed:false,code:"membership_required"};
  // Idempotency states (both reserve RPCs): this same request reference
  // already holds a live reservation, or already consumed its allowance for
  // a completed generation. The allowance HAS verified — the reservation
  // belongs to this exact request — so generation proceeds and the
  // downstream begin/complete calls, themselves idempotent on the request
  // reference, replay or finish it. These states previously fell through to
  // "unavailable", so a member whose first attempt failed downstream (a
  // provider error, a timeout) and who retried with the same reference —
  // the /create flow deliberately reuses it per input — was told their
  // allowance "could not be verified" for up to the 30-minute reservation
  // lifetime despite a perfectly verifiable allowance.
  if (data?.allowed===false && data?.state==="already_reserved")
    return {allowed:true,tracked:true,kind,requestId,
      remaining:data.remaining??null,already_reserved:true};
  if (data?.allowed===false && data?.state==="already_completed")
    return {allowed:true,tracked:false,kind,requestId,
      remaining:data.remaining??null,already_completed:true};
  if (data?.allowed!==true ||
      !["reserved","admin_exempt","paid_or_admin_exempt"].includes(data.state))
    return {allowed:false,code:"unavailable"};
  return {allowed:true,tracked:data.state==="reserved",kind,requestId,remaining:data.remaining??null};
}
export async function completeTrialContent(env,jwt,receipt,fetcher=fetch) {
  if(!receipt?.tracked)return true;
  return invoke(env,jwt,"ifund_ai_content_complete",
    {p_request_id:receipt.requestId,p_kind:receipt.kind},fetcher);
}
export async function releaseTrialContent(_env,_jwt,_receipt,_fetcher=fetch) {
  // Authenticated users cannot delete active reservations: that would let
  // forged browser calls remove in-flight usage and defeat the shared cap.
  // The database expires unsuccessful reservations after thirty minutes.
  // A future trusted service-role-only cleanup path can release sooner.
  return false;
}
