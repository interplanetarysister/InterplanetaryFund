// Source-only team context adapter. Does not authorize a provider or change payments.
// All writes use the *verified current user JWT*; agent replies additionally need
// the existing privileged Worker credential. Enabled only after DB acceptance.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const TEAM_CONTEXT_AGENTS=Object.freeze(["story","nexus","orbit","echo","pulse","polaris","forge","link","discover"]);
// Best-effort safety net for secrets mistakenly included in a conversation.
// These patterns do not replace authenticated ownership, careful data handling,
// or specialist vaults for payment/provider credentials.
export function redactTeamCredentials(value) {
  return String(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/gi,"Bearer [redacted]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g,"[redacted credential]")
    .replace(/\b(password|api[ _-]?key|access[ _-]?token|secret)\s*[:=]\s*([^\s,;]+)/gi,"$1: [redacted]");
}

export function validateTeamContextEvent({eventKey,agentId,content,campaignId=null,speaker="user"}) {
  if(!["user","agent"].includes(speaker) || !UUID.test(eventKey||"") || !TEAM_CONTEXT_AGENTS.includes(agentId)
    || typeof content!=="string" || !content.trim()
    || content.trim().length>(speaker==="agent"?24000:4000) || (campaignId!==null && !UUID.test(campaignId)))
    throw Object.assign(new Error("Invalid team conversation event."),{status:400});
  return {p_event_key:eventKey,p_agent_id:agentId,p_content:content.trim(),p_campaign_id:campaignId};
}
export function replyEventKey(requestId) {
  if(!UUID.test(requestId||"")) throw Error("Invalid request reference.");
  // Deterministically distinct from the user-message key for idempotent retries.
  const bits=requestId.replace(/-/g,"").split("");
  // Toggle rather than overwrite UUID bits: distinct request IDs must never
  // collapse to one agent reply idempotency key (including differing variants).
  bits[12]=(parseInt(bits[12],16)^1).toString(16);
  const tail=bits.slice(20).join("");
  const changed=(parseInt(tail[0],16)^8).toString(16)+tail.slice(1);
  return bits.slice(0,8).join("")+"-"+bits.slice(8,12).join("")+"-"+
    bits.slice(12,16).join("")+"-"+bits.slice(16,20).join("")+"-"+changed;
}
export async function appendTeamContext({env,jwt,eventKey,agentId,content,campaignId=null,speaker,fetcher=fetch}) {
  if(env.IFUND_TEAM_CONTEXT_ENABLED!=="enabled") return {state:"disabled"};
  if(!/^[-\w.]+$/.test(jwt||"")) throw Error("Verified member token required.");
  if(typeof content!=="string") throw Object.assign(new Error("Invalid team conversation event."),{status:400});
  const args=validateTeamContextEvent({eventKey,agentId,content:redactTeamCredentials(content),campaignId,speaker});
  if(!["user","agent"].includes(speaker)) throw Error("Invalid team context speaker.");
  // Both user and agent event provenance must be attested by a real iFund Worker.
  if(!/^[a-f0-9]{64}$/.test(env.IFUND_WORKFORCE_EXECUTOR_KEY||""))
    throw Error("Trusted agent executor is not configured.");
  const response=await fetcher(env.SUPABASE_URL+"/rest/v1/rpc/ifund_team_record_"+speaker,{
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:env.SUPABASE_PUBLISHABLE_KEY,
      Authorization:"Bearer "+jwt,
      "x-ifund-workforce-key":env.IFUND_WORKFORCE_EXECUTOR_KEY},
    body:JSON.stringify(args),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok) throw Error("The team conversation could not be saved.");
  const id=await response.json();
  if(!UUID.test(id||"")) throw Error("The team context receipt could not be verified.");
  return {state:"saved",id};
}

/**
 * Same-owner retrieval for any of the nine authorized agents. The caller must
 * pass the current verified member JWT, never an owner ID supplied by a model.
 * The database RPC enforces owner and campaign scope, plus deletion tombstones.
 */
export async function readTeamContext({env,jwt,campaignId=null,limit=12,before=null,beforeId=null,fetcher=fetch}) {
  if(env.IFUND_TEAM_CONTEXT_ENABLED!=="enabled") return {state:"disabled",events:[]};
  if(!/^[-\w.]+$/.test(jwt||"")) throw Error("Verified member token required.");
  if(campaignId!==null&&!UUID.test(campaignId)) throw Object.assign(new Error("Invalid campaign reference."),{status:400});
  if(!Number.isInteger(limit)||limit<1||limit>60) throw Object.assign(new Error("Invalid history page size."),{status:400});
  if((before===null)!==(beforeId===null)||beforeId!==null&&!UUID.test(beforeId))
    throw Object.assign(new Error("Invalid history cursor."),{status:400});
  if(before!==null&&(typeof before!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(before)||!Number.isFinite(Date.parse(before))))
    throw Object.assign(new Error("Invalid history cursor."),{status:400});
  const response=await fetcher(env.SUPABASE_URL+"/rest/v1/rpc/ifund_team_recent",{
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+jwt},
    body:JSON.stringify({p_campaign_id:campaignId,p_limit:limit,p_before:before,p_before_id:beforeId}),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok) throw Error("Your private team history is temporarily unavailable.");
  const events=await response.json();
  if(!Array.isArray(events)||events.length>limit||events.some(e=>!UUID.test(e?.id||"")||!UUID.test(e?.event_key||"")||!TEAM_CONTEXT_AGENTS.includes(e?.agent_id)||!["user","agent"].includes(e?.speaker)||typeof e?.content!=="string"))
    throw Error("The team history response could not be verified.");
  return {state:"ready",events};
}
