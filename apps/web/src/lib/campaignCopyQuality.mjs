/**
 * Shared campaign copy quality guidelines and output checks for the existing
 * Story Agent, creator preview and weekly specialist practicum.
 * This is editorial guidance, never donor profiling, inference permission,
 * payment authorization, or a claim that any message increases donations.
 */
export const CAMPAIGN_COPY_STANDARD_VERSION = "2026-11-25-v1";
export const CAMPAIGN_COPY_ANGLES = Object.freeze([
  {id:"specific_need",instruction:"Make the verified person, project or concrete need immediately understandable, using an authentic subject and no vague slogan."},
  {id:"human_empathy",instruction:"Invite empathy through dignified, organizer-provided circumstances; do not imply distress or shame that was not supplied."},
  {id:"hope_and_progress",instruction:"Show a credible next step or possibility, not a guaranteed result or invented milestone."},
  {id:"shared_agency",instruction:"Invite a voluntary part in the solution: support, share, learn more, or follow the story without pressuring the reader."},
  {id:"meaning_and_potential",instruction:"Explain the distinctive community, creative or business opportunity only when supported by the submitted facts; never promise profit, return on investment, donor tax deductions, jobs or success."},
]);
export const CAMPAIGN_COPY_GUIDANCE = [
  "Every option must clearly connect to the organizer's actual need, beneficiary, circumstance or mission.",
  "Assess the stated context before choosing an appropriate motivation; do not assign demographic or psychological traits to donors.",
  "Five titles must explore meaningfully different, context-appropriate hooks rather than swapping synonyms around an identical headline.",
  "Two short descriptions must offer two different approaches, each complementing the titles and main story with a clear truthful purpose and optional next step.",
  "Combine a human reason to care with a concrete purpose or next step; avoid melodrama, jargon, generic inspirational phrases and clickbait.",
  "Make the campaign title, descriptions, story, imagery direction and sharing message form a coherent, fact-consistent narrative.",
  "Never invent urgency, scarcity, diagnoses, endorsements, evidence, impact, projected revenue, investment returns, beneficiary consent, or previous donations.",
  "Business projects may describe owner-verified potential or a practical plan, but donations are not investments unless a separately verified compliant offering exists.",
  "No manipulative guilt, false hope, stereotyping or exploitation of vulnerability. Giving is voluntary and may include sharing instead.",
].join(" ");
const words = value => String(value || "").normalize("NFKC").toLocaleLowerCase("en-US")
  .match(/[\p{L}\p{N}]+/gu) || [];
const tokenSet = value => new Set(words(value).filter(w => w.length > 2));
function nearSame(a,b) {
  const left=tokenSet(a),right=tokenSet(b);
  if (!left.size||!right.size) return true;
  const common=[...left].filter(x=>right.has(x)).length;
  const union=new Set([...left,...right]).size;
  const min=Math.min(left.size,right.size);
  const max=Math.max(left.size,right.size);
  if (left.size===right.size && common===left.size) return true;
  // Subset paraphrases with one extra word are still redundant; two-word
  // slogans share too little evidence to judge on word overlap alone.
  return min>=4 && (common/union>=.70 || (common/min>=.85 && common/max>=.70));
}
export function findRedundantCampaignOptions(options) {
  if (!Array.isArray(options)) throw new TypeError("Campaign copy options must be an array");
  const conflicts=[];
  for(let i=0;i<options.length;i++)
    for(let j=i+1;j<options.length;j++)
      if(nearSame(options[i],options[j]))conflicts.push([i,j]);
  return conflicts;
}
export function requireDistinctCampaignOptions(titles,summaries) {
  if (!Array.isArray(titles)||!Array.isArray(summaries)) return false;
  return findRedundantCampaignOptions(titles).length===0 &&
    findRedundantCampaignOptions(summaries).length===0;
}
/**
 * Owner-supplied facts only; encourage specificity without fabricating
 * details or implying verified results. Free fallback is an OUTLINE,
 * not AI-generated prose or experimentally proven fundraising advice.
 */
export function freeCopyOutlineOptions({beneficiary,need,cause}={}) {
  const subject=(need||"this effort").trim().slice(0,100);
  const audience=(beneficiary||"the people this effort supports").trim().slice(0,100);
  const category=(cause||"").replace(/_/g," ").trim().slice(0,100);
  const fit=(s,max=150)=>s.length<=max?s:s.slice(0,max-1).trimEnd()+"…";
  const titles=[
    fit(`Help make ${subject} possible`),
    fit(`Why ${audience} needs our support`),
    fit(`A hopeful next step for ${audience}`),
    fit(`Join the effort to support ${subject}`),
    fit(category?`The ${category} mission: ${subject}`:`What your support could make possible`),
  ];
  const summaries=[
    fit(`${audience} could benefit from ${subject}. Learn what this campaign is working toward and decide whether to help or share.`,500),
    fit(`This effort focuses on ${subject}${category?` as a ${category} project`:""}. Explore the organizer's plan and consider taking part.`,500),
  ];
  return {titles,summaries};
}
