// Shared, reviewable agent skill-routing directory. It is guidance, not tool permission.
// Weekly lessons update this catalog only after evidence, review and reproducible checks.
export const TRAINING_VERSION = "2026-11-14-round-1";
export const TRAINING_ROLES = Object.freeze({
  story: {skill:"Authentic, empathetic campaign storytelling",handles:["campaign narrative","story structure","tone","beneficiary dignity","clarity of ask"],consult:["orbit","polaris","echo"],lesson:"Translate verified purpose and spending facts into a dignified, concrete, emotionally resonant story; no invented details or guarantees."},
  orbit: {skill:"Financial clarity and donor trust",handles:["campaign budget","spending plan","fees","financial disclosures","verified amounts"],consult:["story","polaris"],lesson:"Make credible itemized costs, contingency, fees, and spending updates easy for donors to understand; partner funds remain external."},
  polaris: {skill:"Campaign strategy and audience-fit",handles:["campaign goals","milestones","donor motivations","readiness rubric","measurement design"],consult:["story","forge","orbit"],lesson:"Build evidence-grounded, inclusive audience hypotheses; explain readiness without predicting donation probability."},
  forge: {skill:"Campaign growth and attribution",handles:["referral tracking","campaign performance","testing","conversion measurement","distribution effectiveness"],consult:["pulse","echo","link"],lesson:"Separate visits, referrals, attributed verified gifts, estimates and owner-reported totals; tests need adequate denominators."},
  echo: {skill:"Supporter communications and stewardship",handles:["email copy","updates","thank-you notes","message accessibility","donor retention"],consult:["story","orbit","pulse"],lesson:"Write respectful, opt-in updates that communicate progress, spending transparently, and invite rather than pressure."},
  pulse: {skill:"Responsible outreach and opportunity matching",handles:["distribution plan","opportunity matches","application drafts","consented publicity"],consult:["link","echo","polaris"],lesson:"Match cause to relevant audiences and partners without stereotyping, spam, false urgency, or unapproved outreach."},
  link: {skill:"Authorized connections and provider capabilities",handles:["external platform links","OAuth status","connection repair","provider authorization"],consult:["discover","orbit","forge"],lesson:"Differentiate public link, verified authorization, read API, webhook and checkout; never invent access or partnerships."},
  discover: {skill:"Provider and source discovery",handles:["fundraising host research","provider policies","source quality","integration feasibility"],consult:["link","pulse"],lesson:"Verify host capabilities and terms with dated credible sources before recommending integration; consolidate actions through LINK."},
  nexus: {skill:"Chief-of-staff triage and cross-agent routing",handles:["complex requests","agent selection","cross-specialist handoffs","campaign priorities","status validation"],consult:["story","orbit","polaris","forge","echo","pulse","link","discover"],lesson:"Route multi-domain tasks with owner consent, preserve context and evidence labels, verify completion before reporting success."}
});
export const TRAINING_ROUTE_RULES = Object.freeze([
  {keywords:["budget","spending","cost breakdown","fees","how funds"],target:"orbit"},
  {keywords:["story","narrative","empathy","rewrite","headline"],target:"story"},
  {keywords:["oauth","connect","linked account","provider"],target:"link"},
  {keywords:["measure","attribution","conversion","analytics"],target:"forge"},
  {keywords:["outreach","opportunity","promote"],target:"pulse"},
  {keywords:["message","email","thank"],target:"echo"},
  {keywords:["strategy","goal","milestone","readiness"],target:"polaris"},
  {keywords:["research","which platform"],target:"discover"}
]);
export function recommendAgent(question, currentAgent="nexus") {
  const q=String(question||"").toLowerCase();
  const matching=TRAINING_ROUTE_RULES.find(rule=>rule.keywords.some(k=>q.includes(k)));
  const target=matching?.target||"nexus";
  return {target,shouldHandoff:target!==currentAgent,reason:TRAINING_ROLES[target].skill,verifiedExecution:false};
}
