// Shared, reviewable agent skill-routing directory. It is guidance, not tool permission.
// Weekly lessons update this catalog only after evidence, review and reproducible checks.
export const TRAINING_VERSION = "2026-11-25-campaign-copy-coordination-v2";
export const TEAM_CONTEXT_POLICY = Object.freeze({scope:"authenticated_owner_team",source:"all_authorized_agent_interactions",internalSharing:"automatic",repeatedHandoffConsent:false,externalSharing:"separate_authorization_required",secrets:"excluded",crossOwnerAccess:"denied",availableAtRuntime:false});
export const TRAINING_ROLES = Object.freeze({
  story: {skill:"Authentic, empathetic campaign storytelling",handles:["campaign narrative","story structure","tone","beneficiary dignity","clarity of ask"],consult:["orbit","polaris","echo"],lesson:"Use the organizer’s verified purpose to craft five genuinely different, contextual and empathetic campaign titles and two distinctive summaries; connect each to the coherent story and the ask, applying truthful psychological influence (social engineering: real social proof, identity, reciprocity, concrete impact) to move readers to act — never invented details or guarantees. Review weekly storytelling and campaign readability research with POLARIS and ECHO."},
  orbit: {skill:"Financial clarity and donor trust",handles:["campaign budget","spending plan","fees","financial disclosures","verified amounts"],consult:["story","polaris"],lesson:"Make credible itemized costs, contingency, fees, and spending updates easy for donors to understand; partner funds remain external."},
  polaris: {skill:"Campaign strategy and audience-fit",handles:["campaign goals","milestones","donor motivations","readiness rubric","measurement design"],consult:["story","forge","orbit"],lesson:"Assess a campaign’s supplied context and choose among specific need, dignified empathy, credible hope, collective agency or supported project potential. Coordinate nonredundant title and short-description angles with STORY and ECHO; evaluate clarity and truth without psychological profiling or predicting conversion."},
  forge: {skill:"Campaign growth and attribution",handles:["referral tracking","campaign performance","testing","conversion measurement","distribution effectiveness"],consult:["pulse","echo","link"],lesson:"Separate visits, referrals, attributed verified gifts, estimates and owner-reported totals; tests need adequate denominators."},
  echo: {skill:"Supporter communications and stewardship",handles:["email copy","updates","thank-you notes","message accessibility","donor retention"],consult:["story","orbit","pulse"],lesson:"Turn STORY and POLARIS campaign angles into varied short descriptions, social previews, opt-in thank-you notes and accessible supporter messages that share the same verified purpose; respect donor consent and never treat an unverified milestone as a receipt. Avoid repetitive hooks, clickbait and pressure. Compare weekly approved lessons before applying changes."},
  pulse: {skill:"Responsible outreach and opportunity matching",handles:["distribution plan","opportunity matches","application drafts","consented publicity"],consult:["link","echo","polaris"],lesson:"Match cause to relevant audiences and partners without stereotyping, spam, false urgency, or unapproved outreach."},
  link: {skill:"Authorized connections and provider capabilities",handles:["external platform links","OAuth status","connection repair","provider authorization"],consult:["discover","orbit","forge"],lesson:"Differentiate public link, verified authorization, read API, webhook and checkout; never invent access or partnerships."},
  discover: {skill:"Provider and source discovery",handles:["fundraising host research","provider policies","source quality","integration feasibility"],consult:["link","pulse"],lesson:"Verify host capabilities and terms with dated credible sources before recommending integration; consolidate actions through LINK."},
  nexus: {skill:"Chief-of-staff triage and cross-agent routing",handles:["complex requests","agent selection","cross-specialist handoffs","campaign priorities","status validation"],consult:["story","orbit","polaris","forge","echo","pulse","link","discover"],lesson:"Route multi-domain tasks through existing owner-authorized team context, preserve context and evidence labels, verify completion before reporting success."}
});
// Front-desk consolidation (owner directive 2026-11-26): members talk to a
// small number of front-door agents, never to every backend specialist.
// REACH is the single front door for outreach (ECHO + PULSE), connections
// (LINK) and growth (FORGE). The backend specialists keep their own skills,
// routes and audit identities; only the member-facing chat is consolidated.
// DISCOVER was already consolidated into LINK the same way (see
// agentWorkspaces.mjs). This map is presentation and routing guidance, not
// a capability grant.
export const FRONT_DESK_BACKENDS = Object.freeze({
  reach: Object.freeze(["echo", "pulse", "link", "forge"]),
});
export const isFrontDeskAgent = id => Object.hasOwn(FRONT_DESK_BACKENDS, id);
export function frontAgentForSpecialist(id) {
  for (const [front, backends] of Object.entries(FRONT_DESK_BACKENDS))
    if (backends.includes(id)) return front;
  return id;
}
// Role discovery is not a capability grant. Mixed-topic requests require a
// coordinating agent, regardless of which specialists are involved.
export const TRAINING_ROUTE_RULES = Object.freeze([
  {target:"orbit",keywords:["budget","spending","expenses","expense","cost","costs","cost breakdown","fees","how funds","funds will be spent","donation allocation"]},
  {target:"story",keywords:["story","narrative","empathy","rewrite","headline","campaign title","short description","fundraising appeal","tell my story"]},
  {target:"link",keywords:["oauth","connect","linked account","account permissions","connection repair","provider authorization"]},
  {target:"forge",keywords:["measure","attribution","conversion","analytics","referral","performance tracking","donations came from"]},
  {target:"pulse",keywords:["outreach","opportunity","promote","distribution","grant match"]},
  {target:"echo",keywords:["message","email","thank","supporter update","newsletter"]},
  {target:"polaris",keywords:["strategy","goal","milestone","readiness","audience planning"]},
  {target:"discover",keywords:["research","which platform","fundraising platform options","provider comparison"]}
]);
const normalize = value => String(value || "").normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu," ").trim();
const matchesPhrase = (input, phrase) => (" " + input + " ").includes(" " + normalize(phrase) + " ");
export function recommendAgent(question, currentAgent = "nexus") {
  const text=normalize(question);
  const topics=[...new Set(TRAINING_ROUTE_RULES
    .filter(rule=>rule.keywords.some(term=>matchesPhrase(text,term)))
    .map(rule=>rule.target))];
  const requiresCoordination=topics.length>1;
  const target=requiresCoordination ? "nexus" : (topics[0] || "nexus");
  return {target,topics,requiresCoordination,
    shouldHandoff:target!==currentAgent,
    reason:requiresCoordination ? "This request involves multiple specialists; NEXUS can coordinate." : TRAINING_ROLES[target].skill,
    verifiedExecution:false};
}
// This creates a generic routing proposal. A verified same-owner team may reuse
// stored user context without repeated handoff consent. No action occurs here.
export function proposedSpecialistHandoff(question, currentAgent = "nexus") {
  const result=recommendAgent(question,currentAgent);
  const workflow=result.requiresCoordination ? result.topics : (result.shouldHandoff ? [result.target] : []);
  return {...result,workflow,usesExistingTeamContext:true,requiresNewHandoffConsent:false,teamContextScope:TEAM_CONTEXT_POLICY.scope,state:"proposed",transmitted:false,
    message:"All agents serving the same account may use its authorized team conversation context. This recommendation has not contacted a specialist."};
}
