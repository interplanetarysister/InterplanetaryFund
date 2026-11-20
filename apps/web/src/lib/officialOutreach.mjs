// Administrator-only historical account recovery. Never treats historical
// profile/seed data as a live provider grant or credential.
export const OFFICIAL_OUTREACH_COPY=Object.freeze({
  short:"What if your next fundraiser could reach further? Interplanetary Fund helps people create, manage and share fundraising campaigns, with AI-assisted writing and tools for connecting to outside platforms. Explore: https://interplanetaryfund.com",
  about:"Interplanetary Fund is a fundraising platform built to help everyday people turn a need or an idea into a campaign they can manage and share. Its tools support campaign writing, presentation, discovery and account connections, with the goal of helping fundraisers reach more people. Platform availability, provider integrations and payment features vary; verify current capabilities before making a promise. Learn more at https://interplanetaryfund.com",
  partners:"We are building Interplanetary Fund to make fundraising easier to start, manage and share. We are interested in speaking with organizations, funders and platform partners who support accessible fundraising, community resilience and responsible technology. If there is a potential fit, explore the project and contact us through https://interplanetaryfund.com. We do not claim to have secured outside funding or a partnership unless it is independently confirmed."
});
const STATES=new Set(["unverified","needs_login","provider_verification_required","unsupported"]);
const ALLOWED=new Set(["facebook","x","instagram","whatsapp","github","gofundme",
"patreon","buymeacoffee","kofi","spotfund","fundrazr","givesendgo",
"indiegogo","kickstarter","bluesky"]);
export function validateOutreachCandidate(row){
  if(!row||typeof row!=="object"||!ALLOWED.has(row.provider)||
    !STATES.has(row.review_status)||!["historical_active","historical_pending"].includes(row.legacy_claim)||
    typeof row.display_name!=="string"||typeof row.historical_login_email!=="string"||
    typeof row.historical_handle!=="string"||
    !Number.isInteger(row.verified_provider_connections)||
    row.verified_provider_connections<0)
    throw new Error("Outreach account evidence is incomplete.");
  return row;
}
export async function fetchOfficialOutreachCandidates(client){
  const {data:user,error}=await client.auth.getUser();
  if(error||!user?.user?.id||!user.user.email_confirmed_at||user.user.is_anonymous===true)
    throw new Error("A verified iFund administrator session is required.");
  const result=await client.rpc("ifund_admin_outreach_candidates");
  if(result.error||!Array.isArray(result.data))
    throw new Error("The private outreach inventory could not be verified.");
  return result.data.map(validateOutreachCandidate);
}
export async function reviewOfficialOutreachCandidate(client,{provider,status,notes=""}){
  if(!ALLOWED.has(provider)||!STATES.has(status)||notes.length>700)
    throw new Error("Invalid recovery review.");
  const {data:user,error}=await client.auth.getUser();
  if(error||!user?.user?.id||!user.user.email_confirmed_at||user.user.is_anonymous===true)
    throw new Error("A verified iFund administrator session is required.");
  const {data,error:writeError}=await client.rpc("ifund_admin_review_outreach_candidate",{
    p_provider:provider,p_review_status:status,p_notes:notes
  });
  if(writeError||data?.provider!==provider||data.review_status!==status||
    data.connected!==false||data.publish_granted!==false)
    throw new Error("Recovery review was not confirmed. No provider account was connected.");
  const rows=await fetchOfficialOutreachCandidates(client);
  const record=rows.find(row=>row.provider===provider);
  if(!record||record.review_status!==status||record.verification_notes!==(notes.trim()||null))
    throw new Error("Recovery review was not persisted.");
  return record;
}
