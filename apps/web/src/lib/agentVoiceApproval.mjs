// Voice intent parsing is only a proposal to confirm a pending action.
// It never authorizes, signs, or executes tool calls.
const APPROVE=/^(?:yes[, ]*)?(?:i )?(?:approve|authorize|confirm)(?: (?:this|that|the (?:proposed )?action))?[.!]?$/i;
const DENY=/^(?:no[, ]*)?(?:i )?(?:deny|reject|cancel|decline)(?: (?:this|that|the (?:proposed )?action))?[.!]?$/i;
export const HIGH_RISK_ACTIONS=Object.freeze([
  "payment","withdrawal","refund","transfer","publish_external","send_external",
  "grant_submission","account_security","delete_account","delete_campaign","oauth_change"
]);
export function classifySpokenDecision(text){
  if(typeof text!=="string" || text.length>160) return "unknown";
  const utterance=text.trim().replace(/\s+/g," ");
  if(APPROVE.test(utterance)) return "approve";
  if(DENY.test(utterance)) return "deny";
  return "unknown";
}
export function evaluateVoiceActionIntent({transcript,pending,ownerId,now=Date.now()}){
  const decision=classifySpokenDecision(transcript);
  if(!pending || typeof pending!=="object") return {state:"no_pending_action",decision:"unknown",execute:false};
  if(pending.ownerId!==ownerId || !ownerId) return {state:"owner_mismatch",decision:"unknown",execute:false};
  if(!Number.isFinite(pending.expiresAt) || now>=pending.expiresAt) return {state:"expired",decision:"unknown",execute:false};
  if(pending.status!=="awaiting_review" || !pending.actionId || !pending.parametersHash)
    return {state:"invalid_proposal",decision:"unknown",execute:false};
  if(decision==="deny") return {state:"deny_requested",decision,execute:false};
  if(decision==="approve" && HIGH_RISK_ACTIONS.includes(pending.actionType))
    return {state:"screen_confirmation_required",decision,execute:false};
  if(decision==="approve") return {state:"backend_confirmation_required",decision,execute:false};
  return {state:"clarification_required",decision,execute:false};
}
