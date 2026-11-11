// Free, deterministic pre-screening for source-verified external opportunities.
// This is NOT an AI eligibility decision, automatic application, or guarantee.
const STOP=new Set(["about","after","again","against","and","before","campaign","community","could","from","have","into","make","more","need","needs","other","people","project","projects","provide","raise","raising","their","them","there","these","this","through","under","what","when","where","which","with","would","your"]);
const ALIASES={disaster_relief:["disaster","emergency","relief"],medical:["health","healthcare","wellness"],animals:["animal","wildlife","rescue"],environment:["climate","sustainability","ecology"],creative:["arts","art","music","creative"],education:["school","learning","literacy"],community:["neighborhood","local","volunteer"],science:["research","technology","innovation"]};
const keywords=value=>String(value||"").toLowerCase().replace(/_/g," ").match(/[a-z]{4,}/g)?.filter(w=>!STOP.has(w))||[];
export function publicCampaignTerms(campaign) {
  if(!campaign)return new Set();
  const category=String(campaign.category||"").toLowerCase().replace(/[^a-z_]/g,"");
  const input=[category,String(campaign.title||"").slice(0,300),String(campaign.summary||"").slice(0,1600)];
  const terms=new Set(keywords(input.join(" ")));
  if(category)terms.add(category);
  for(const synonym of ALIASES[category]||[])terms.add(synonym);
  return terms;
}
export function matchOpportunity(opportunity,campaign) {
  if(!campaign)return {score:0,tags:[],summary:"Select a published campaign to see a topic match."};
  const tags=Array.isArray(opportunity.cause_tags)?opportunity.cause_tags:
    String(opportunity.causes_supported||"").toLowerCase().split(",").map(s=>s.trim());
  const terms=publicCampaignTerms(campaign);
  const matching=tags.filter(t=>{
    const tag=String(t||"").toLowerCase().trim();
    return tag && (terms.has(tag) || keywords(tag).some(w=>terms.has(w)));
  });
  const unique=[...new Set(matching)];
  const direct=String(campaign.category||"").toLowerCase();
  const score=unique.reduce((sum,t)=>sum+(t===direct?3:1),0);
  return {score,tags:unique,summary:unique.length
    ? "Topic overlap: "+unique.slice(0,4).map(t=>t.replace(/_/g," ")).join(", ")+". Check geography, eligibility, dates, and official terms."
    : "No direct topic overlap detected. Check eligibility before treating this as a campaign match."};
}
