// Source-only team context adapter. Does not authorize a provider or change payments.
// All writes use the *verified current user JWT*; agent replies additionally need
// the existing privileged Worker credential. Enabled only after DB acceptance.
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CANONICAL_SUPABASE_URL="https://ssibsfmtodgximseeqsv.supabase.co";
function requireCanonicalSupabase(env){
  if(env?.SUPABASE_URL!==CANONICAL_SUPABASE_URL||!env?.SUPABASE_PUBLISHABLE_KEY)
    throw Error("The team context service is not configured for the canonical IFund project.");
}
export const TEAM_CONTEXT_AGENTS=Object.freeze(["story","nexus","orbit","echo","pulse","polaris","forge","link","discover"]);
// Best-effort safety net for secrets mistakenly included in a conversation.
// These patterns do not replace authenticated ownership, careful data handling,
// or specialist vaults for payment/provider credentials.
// Redaction is defense-in-depth, not a substitute for rejecting credentials at ingress.
export function redactTeamCredentials(value) {
  const text=String(value);
  // Structured JSON credential fields can contain nested objects, arrays,
  // numeric tokens or booleans. Reject the whole ambiguous payload rather
  // than preserving a secret inside an incompletely sanitized structure.
  if (/\\*["'](?:[A-Za-z0-9_-]*[_-])?(?:password|passphrase|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|private[_ -]?key|authorization|oauth[_ -]?code)\\*["']\s*:\s*(?:\[|\{|-?\d|true\b|false\b|null\b)/i.test(text))
    return '[redacted credential payload]';
  return text
    // OAuth authorization codes in URL query/fragment parameters are credentials.
    // Limit replacement to a URL's code parameter, not ordinary prose using "code".
    // Preserve parameter separators and neighboring state values.
    .replace(/(https?:[/][/][^\s<>"']+|[/][A-Za-z0-9_./%-]+[?][^\s<>"']+)/gi,
      url => {
        // A percent-encoded key without a delimiter may be concatenated to
        // another parameter during normalization. Never preserve that URL.
        if (/%(?:25)*(?:63|43)ode(?:=|%(?:25)*3d)/i.test(url))
          return '[redacted credential URL]';
        // Normalize nested query encodings. Treat authorization codes and
        // aliases as credentials; leave non-secret parameters intact.
        let normalized=url;
        for(let i=0;i<12;i++) {
          const next=normalized
            .replace(/&(?:amp|#0*38|#x0*26);/gi,'&')
            .replace(/%[0-9a-f]{2}/gi,part=>{
              const byte=parseInt(part.slice(1),16);
              // decodeURIComponent throws on standalone non-UTF8 bytes.
              // Decode only ASCII parameter syntax; fail closed on ambiguity.
              return byte<128?String.fromCharCode(byte):part;
            });
          if(next===normalized) break;
          normalized=next;
        }
        const codeKey='(?:code|auth[_-]?code|oauth[_-]?code|authorization[_-]?code|id[_-]?token|session[_-]?token|jwt|token)';
        // Array-style and control-character suffixed credential keys must not
        // survive merely because they are not exact `code=` matches.
        if (/[?#&;](?:code|auth[_-]?code|oauth[_-]?code|authorization[_-]?code|id[_-]?token|session[_-]?token|jwt|token)(?:\[[^\]&#;]*\]|\.[^=&#;\s]*|[\x00-\x1f])=/i.test(normalized))
          return '[redacted credential URL]';
        const codeParam=new RegExp('([?#&;]'+codeKey+'=)([^&#;\\s]+)','gi');
        const cleaned=normalized.replace(codeParam,(_part,prefix)=>prefix+'[redacted]');
        // If nested encodings still obscure a potentially secret parameter,
        // discard the entire URL instead of returning it to shared history.
        if(/%[0-9a-f]{2}|&(?:amp|#0*38|#x0*26);/i.test(cleaned) &&
          /(?:code|%[0-9a-f]{2})/i.test(cleaned))
          return '[redacted credential URL]';
        return cleaned;
      })
    // Escaped JSON embedded in logs or serialized conversation strings.
    .replace(/(\\["'])(?:[A-Za-z0-9_-]*_)?(password|passphrase|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|private[_ -]?key|authorization|oauth[_ -]?code|code)\1(\s*:\s*)(\\["'])(?:\\.|(?!\\["'])[\s\S])*?\4/gi,
      (_match,quote,key,separator)=>quote+key+quote+separator+'\\"[redacted]\\"')
    // JSON string properties; "code" is redacted only when a structured key.
    .replace(/(["'])(?:[A-Za-z0-9_-]*_)?(password|passphrase|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|private[_ -]?key|authorization|oauth[_ -]?code|code)\1(\s*:\s*)(["'])(?:\\.|(?!\4)[^\\])*?\4/gi,
      (_match,quote,key,separator)=>quote+key+quote+separator+'"[redacted]"')
    .replace(/\b(Authorization\s*:\s*(?:Basic|Bearer)\s+)[A-Za-z0-9+/_=-]{4,}/gi,"$1[redacted]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=-]{8,}/gi,"$1 [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,"[redacted credential]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,})\b/g,"[redacted credential]")
    // Prefixed environment variable names such as PAYPAL_CLIENT_SECRET.
    .replace(/\b((?:[A-Za-z0-9]+_)*(?:password|passphrase|api_key|access_token|refresh_token|client_secret|private_key|oauth_code|authorization|secret))(\s*[:=]\s*)(["']?)([^\s,;}"']+)(["']?)/gi,
      (_match,key,separator,open,_secret,close)=>key+separator+open+"[redacted]"+close);
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
  requireCanonicalSupabase(env);
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
  requireCanonicalSupabase(env);
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
  if(!Array.isArray(events)||events.length>limit||events.some(e=>
    !UUID.test(e?.id||"")||!UUID.test(e?.event_key||"")||
    !TEAM_CONTEXT_AGENTS.includes(e?.agent_id)||
    !["user","agent"].includes(e?.speaker)||
    e?.source_kind!==(e?.speaker==="user"?"user_statement":"agent_response")||
    typeof e?.content!=="string"||!e.content.trim()||
    e.content.length>(e.speaker==="user"?4000:24000)||
    (e?.campaign_id!=null&&!UUID.test(e.campaign_id))||
    typeof e?.recorded_at!=="string"||!Number.isFinite(Date.parse(e.recorded_at))))
    throw Error("The team history response could not be verified.");
  // Defense in depth for historical records created before ingress redaction.
  // Never return raw persisted credential material to another team agent.
  return {state:"ready",events:events.map(event=>({
    ...event,content:redactTeamCredentials(event.content)
  }))};
}

/**
 * Reusable, owner-scoped fundraising evidence for every real iFund agent
 * service. This is deliberately separate from public campaign media and
 * external provider claims. File bytes never leave private Storage.
 */
export async function readCampaignDocumentContext({
  env,jwt,campaignId,fetcher=fetch
}) {
  if(env.IFUND_CAMPAIGN_DOCUMENTS_ENABLED!=="enabled")
    return {state:"disabled",briefs:[]};
  requireCanonicalSupabase(env);
  if(!/^[-\w.]+$/.test(jwt||"")) throw Error("Verified member token required.");
  if(!UUID.test(campaignId||"")) throw Object.assign(
    new Error("A saved campaign is required for private documents."),{status:400});
  const response=await fetcher(env.SUPABASE_URL+"/rest/v1/rpc/ifund_campaign_agent_document_briefs",{
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:env.SUPABASE_PUBLISHABLE_KEY,
      Authorization:"Bearer "+jwt},
    body:JSON.stringify({p_campaign_id:campaignId}),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok) throw Error("Owner-approved campaign documents could not be loaded.");
  const raw=await response.json();
  if(!Array.isArray(raw)||raw.length>6||raw.some(d=>
    !UUID.test(d?.document_id||"")||
    typeof d?.file_name!=="string"||d.file_name.length>160||
    typeof d?.purpose!=="string"||d.purpose.length>40||
    typeof d?.summary!=="string"||d.summary.length>3000||
    typeof d?.owner_excerpt!=="string"||d.owner_excerpt.length>1200||
    typeof d?.extracted_excerpt!=="string"||d.extracted_excerpt.length>2000||
    d?.owner_supplied!==true||
    d?.source_type!=="uploaded_private_document_summary"
  )) throw Error("The private document reference response was invalid.");
  return {state:"ready",briefs:raw.map(d=>({
    document_id:d.document_id,
    source_type:"owner_uploaded_reference_unverified",
    file_name:redactTeamCredentials(d.file_name).slice(0,160),
    purpose:redactTeamCredentials(d.purpose).slice(0,40),
    summary:redactTeamCredentials(d.summary).slice(0,3000),
    owner_excerpt:redactTeamCredentials(d.owner_excerpt).slice(0,1200),
    extracted_excerpt:redactTeamCredentials(d.extracted_excerpt).slice(0,2000),
  }))};
}
