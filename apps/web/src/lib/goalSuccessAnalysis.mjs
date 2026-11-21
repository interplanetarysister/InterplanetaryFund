/**
 * Campaign Goal Success Analysis: advisory routes, not scored funding claims.
 * No lead, amount, grant eligibility, contribution or agent action is invented.
 * The existing readiness RPC remains the sole campaign-readiness source.
 */
export const SUPPORT_CHANNELS=Object.freeze([
  {id:"crowdfunding",title:"Crowdfunding and donations",role:"NEXUS + STORY",kind:"funds",
    route:"/fundraising-partners",why:"Make the public story credible and choose the right fundraising host.",
    start:"Compare first-party fundraising and trusted external campaign hosts."},
  {id:"grants",title:"Grants and awards",role:"DISCOVER + POLARIS",kind:"funds",
    route:"/institutions",why:"Search programs that may fit your purpose and applicant type.",
    start:"Check the provider's stated eligibility, deadlines, and allowed uses."},
  {id:"sponsors",title:"Sponsors and partnerships",role:"PULSE + ECHO",kind:"funds_or_resources",
    route:"/institutions",why:"Seek organizations with an authentic interest in the project.",
    start:"Prepare a specific proposal and verify each recipient's contact permissions."},
  {id:"earnings",title:"Work and earned income",role:"FORGE + ORBIT",kind:"funds",
    route:"/fund-your-mission",why:"Explore ways to earn funds through services, products, and legitimate tasks.",
    start:"Estimate time, expenses, eligibility, and actual take-home income."},
  {id:"resources",title:"Equipment and donated supplies",role:"LINK + DISCOVER",kind:"noncash",
    route:"/institutions",why:"Reduce the required cash by obtaining equipment or materials.",
    start:"Make a factual inventory of required goods and safe ways to obtain them."},
  {id:"volunteers",title:"Volunteers and skill support",role:"PULSE + LINK",kind:"noncash",
    route:"/institutions",why:"Find appropriate help with logistics, work, expertise, or mentoring.",
    start:"Describe concrete roles, requirements, safety checks, and time commitments."},
  {id:"assistance",title:"Community assistance and benefits",role:"DISCOVER + ORBIT",kind:"resources",
    route:"/institutions",why:"Existing assistance programs may help with urgent essentials.",
    start:"Confirm program availability and geographic and household eligibility."},
  {id:"financing",title:"Loans and investment (optional)",role:"ORBIT + POLARIS",kind:"repayable",
    route:"/finances",why:"Borrowing or investment may be an option, but can create liabilities or equity obligations.",
    start:"Compare repayment, fees, rates, protections and suitability; never assume eligibility."}
]);
const text=v=>typeof v==="string"?v.trim():"";
const has=(s,re)=>re.test(s.toLowerCase());
export function analyzeGoalSuccess(campaign) {
  const c=campaign&&typeof campaign==="object"?campaign:{};
  const topic=[text(c.title),text(c.summary),text(c.story).slice(0,2400)].join(" ");
  const category=text(c.category);
  const business=category==="business"||has(topic,/business|startup|store|shop|sell|customer|enterprise|freelanc|service/);
  const urgent=category==="emergency"||category==="medical"||category==="disaster_relief"||has(topic,/emergenc|rent|utilities|eviction|food|medical|disaster/);
  const community=category==="community"||category==="education"||has(topic,/school|community|volunteer|nonprofit|neighborhood|children|kids/);
  const creative=category==="creative"||has(topic,/art|music|film|book|invention|creative|product/);
  const selected=SUPPORT_CHANNELS.map(channel=>{
    const relevance=channel.id==="crowdfunding" ? "baseline" :
      channel.id==="grants" && (community||creative) ? "explore" :
      channel.id==="sponsors" && (business||community||creative) ? "explore" :
      channel.id==="earnings" && (business||creative) ? "explore" :
      channel.id==="resources" && (business||community||urgent) ? "explore" :
      channel.id==="volunteers" && community ? "explore" :
      channel.id==="assistance" && urgent ? "explore" :
      channel.id==="financing" && business ? "consider_carefully" : "optional";
    return {...channel,relevance,verification:"Not checked for this campaign",confirmedAmount:0};
  }).sort((a,b)=>({baseline:0,explore:1,consider_carefully:2,optional:3}[a.relevance]-{baseline:0,explore:1,consider_carefully:2,optional:3}[b.relevance]));
  const goal=Number(c.goal_amount);
  return {
    title:text(c.title)||"Untitled goal",
    target: Number.isFinite(goal)&&goal>0?goal:null,
    channels:selected,
    suggestedNextStep: !text(c.story)
      ?"Add the outcome you want to accomplish and how support would be used."
      :!Number.isFinite(goal)||goal<=0
        ?"Consider whether you need a cash goal, donated resources, or both."
        :"Use the opportunity directory to verify individual prospects before applying.",
    fundingReceived:null,resourcesConfirmed:null,
    disclaimer:"These are planning pathways inferred from your own campaign, not vetted matches, eligibility decisions, applications, approved funding, or agent actions."
  };
}
