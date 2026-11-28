/**
 * Shared campaign copy quality guidelines and output checks for the existing
 * Story Agent, creator preview and weekly specialist practicum.
 * This is editorial guidance, never donor profiling, inference permission,
 * payment authorization, or a claim that any message increases donations.
 */
export const CAMPAIGN_COPY_STANDARD_VERSION = "2026-11-26-v2";
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
  "Apply psychological influence (social engineering for the member's mission) deliberately and skillfully: real social proof, identity ('people like us support this'), reciprocity, emotional resonance, concrete impact per amount, commitment and a single clear low-friction ask are the craft, and using them well is the job. Influence must run on truth, and the supporter's decision stays voluntary: never fabricate proof, urgency, scarcity, endorsements or outcomes, and never use guilt, false hope, stereotyping or a person's vulnerability as the lever — a persuaded supporter who was told the truth gives again; a deceived one never does.",
].join(" ");
/**
 * Expert writer persona and transformation method (owner directive
 * 2026-11-26): the agent must think like a professional campaign manager
 * writing FOR a client, not a paraphrasing tool. The organizer's text is raw
 * material to understand, never a draft to restate. Facts stay exactly as
 * supplied; the wording, structure and emphasis are the writer's own work.
 */
export const EXPERT_CAMPAIGN_WRITER_METHOD = [
  "Work like a professional campaign manager writing for a client whose cause you have studied, in this order, silently: (1) UNDERSTAND — extract who this is for, what is needed, why now, what the money or support concretely does, and what a supporter gets to be part of; reason about the goal behind the words, including needs the organizer implied but did not state well. (2) CHOOSE AN ANGLE — pick the single strongest honest reason a stranger would care in the first five seconds, and build everything around it. (3) WRITE FRESH — compose new wording from the facts; never lift the organizer's sentences, sentence order, or phrasing. Proper names, exact figures and genuine direct quotes are the only text carried over word for word. (4) SHAPE THE STORY — open on a specific human moment or concrete need, make the stakes plain, explain the plan and how each part of the goal amount maps to it, show what changes when the goal is met, and close with one clear, voluntary invitation (give, share, or follow) and what update supporters will receive. (5) POLISH — vary sentence length, prefer concrete nouns and active verbs, cut every sentence that only repeats an earlier one, and read it as a busy stranger on a phone: if a line would not make them pause, rewrite it.",
  "Write at an easy reading level: short sentences, everyday words, one idea per sentence. Expert means clear and persuasive, never flowery or corporate. Sound like a trusted person who believes in this cause, not like a form letter or a press release.",
  "Psychological influence is the marketing craft: lead with the beneficiary and the change, not the organizer's biography; make the first line earn the second; use the organizer's real specifics (places, items, counts, dates they supplied) as proof; name what a specific amount accomplishes so the reader can picture their own impact; invite the reader into an identity ('join the neighbors who…') using only support that actually exists; remove every friction between feeling and acting — one ask, one next step, no competing requests. End sections with forward motion. Write the share message the way a supporter would actually post it: one human sentence, the concrete need, and the link placeholder left for the owner.",
].join(" ");
export const ANTI_ECHO_RULES = [
  "Do not reuse the organizer's sentences or near-paraphrases of them anywhere in titles, summaries, story or share copy; restating their wording back to them is a failure, even when it is accurate.",
  "Do not follow the organizer's paragraph order; reorganize the facts into the story shape above.",
  "Do not repeat the same fact, appeal or phrase in more than one paragraph; each paragraph must add something new.",
  "Titles must not be the first words of the organizer's text or of the story; each title is its own hook written for a scrolling stranger.",
].join(" ");
const sentencesOf = value => String(value || "").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => words(s).length >= 6);
/**
 * Sentence-level echo detection: returns generated sentences that merely
 * restate the organizer's own sentences (high token overlap), so a caller
 * can request one targeted revision instead of shipping a paraphrase.
 */
export function findEchoedSentences(generated, source) {
  const sourceSentences = sentencesOf(source);
  if (!sourceSentences.length) return [];
  return sentencesOf(generated).filter(sentence =>
    sourceSentences.some(original => nearSame(sentence, original)));
}
const words = value => String(value || "").normalize("NFKC").toLocaleLowerCase("en-US")
  .match(/[\p{L}\p{N}]+/gu) || [];
const tokenSet = value => new Set(words(value).filter(w => w.length > 2));
function nearSame(a,b) {
  const normalized = value => words(value).join(" ");
  if (normalized(a)===normalized(b)) return true;
  const left=tokenSet(a),right=tokenSet(b);
  if (!left.size||!right.size) return false;
  const common=[...left].filter(x=>right.has(x)).length;
  const union=new Set([...left,...right]).size;
  const min=Math.min(left.size,right.size);
  const max=Math.max(left.size,right.size);
  // Subset paraphrases with one extra word are still redundant; two-word
  // slogans share too little evidence to judge on word overlap alone.
  return min>=4 && (common/union>=.70 || (common/min>=.85 && common/max>=.70));
}
/**
 * Public-facing discretion (owner directive 2026-11-28): the organizer's
 * stated needs, goals and asks are INPUT INTELLIGENCE for the writer, never
 * public copy. A member saying "I need users for iFund", "I need money" or
 * "buy myself a car" is telling the agent what the campaign must accomplish;
 * the public text must interpret that need — the obstacle behind it, the
 * change the campaign creates, the reader's role in that change — and never
 * restate the raw need as the appeal. These rules bind the generation
 * prompts and the deterministic output check below.
 */
export const PUBLIC_FACING_DISCRETION_RULES = [
  "Public-facing discretion: the organizer's needs and wants — money, users, signups, customers, a car — are private input intelligence, never public wording; public copy never states a need or goal as the appeal.",
  "Turn each need into the obstacle behind it, the change the campaign creates and the reader's role in that change, written in the beneficiary's world: a car is what it enables (work, appointments, independence); a platform, who it connects and helps.",
  "Never plead in the first person ('I need money', 'help me raise $10,000', 'buy myself a car'); amounts belong to the goal field, never pleaded in prose — prose says what they do. Beneficiary first-person storytelling is not pleading and stays.",
].join(" ");
/**
 * Deterministic public-facing discretion check, in the same spirit as
 * findEchoedSentences: scans generated public copy for the banned framings
 * above. Deliberately conservative, high-precision patterns — the ban
 * targets pleading, need-as-appeal and internal-objective leakage, NOT
 * personal narrative: past-tense or situational first-person storytelling
 * ("After my accident I couldn't get to work", "I needed help learning to
 * walk again"), third-person beneficiary needs ("Maria needs a van to
 * reach her appointments"), legitimate volunteer asks and impact-per-amount
 * statements ("Your $25 covers a week of meals") all pass.
 */
const DISCRETION_PATTERNS = [
  // First-person pleading and raw-need statements.
  ["pleading", /\bhelp me (?:raise|rise|reach|get|fund|pay|buy|collect|hit)\b/i],
  ["pleading", /\b(?:please )?(?:donate|give|send|contribute) to me\b/i],
  ["pleading", /\b(?:give|send) me (?:money|cash|funds|donations)\b/i],
  ["pleading", /\bi (?:really )?(?:need|want) (?:money|cash|funds|donations|financial (?:help|assistance|support))\b/i],
  ["pleading", /\bi(?:'m| am) (?:begging|pleading) for\b/i],
  // Internal objectives (platform/business growth) stated as public copy.
  ["internal_objective", /\b(?:i|we) (?:really )?(?:need|want|seek|am seeking|are seeking|am looking for|are looking for) (?:more )?(?:users|sign-?ups|customers|subscribers|followers|downloads|app installs)\b/i],
  ["internal_objective", /\bneeds? (?:more )?users\b/i],
  ["internal_objective", /\brecruit(?:ing|s|ed)? (?:more )?(?:users|sign-?ups|customers|subscribers)\b/i],
  // Goal amounts pleaded in prose instead of explained by what they do.
  ["amount_pleading", /\b(?:i|we) (?:need|want) to raise\b/i],
  ["amount_pleading", /\braise (?:\$|usd )?\s?\d[\d,]*\s?\$?\s+for me\b/i],
  // Acquiring something for oneself stated as the appeal.
  ["self_purchase", /\bbuy (?:myself|me)\b/i],
  ["self_purchase", /\bpurchase (?:myself|for myself)\b/i],
  ["self_purchase", /\bget myself (?:a|an|the)\b/i],
];
// "Help us raise …" is pleading only when money is the object — raising
// awareness is a legitimate public appeal and is never flagged.
const HELP_US_RAISE = /\bhelp us (?:raise|reach|collect|hit)\b/i;
const MONEY_OBJECT = /(?:\$|money|funds|goal|target)/i;
// A raw-need statement in the organizer's own input: the shape of a need
// being declared, as opposed to background facts about the situation.
const RAW_NEED_STATEMENT = /\b(?:i|we) (?:really )?(?:need|want|am looking for|are looking for)\b|\bhelp me\b|\bbuy (?:myself|me)\b|\bplease donate\b/i;
const copyUnits = value => String(value || "").split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
const rawNeedUnits = source => copyUnits(source).filter(unit => RAW_NEED_STATEMENT.test(unit));
export function findPublicFacingViolations(text, source) {
  const violations = [];
  const seen = new Set();
  const flag = (sentence, rule) => {
    const key = rule + "|" + sentence;
    if (!seen.has(key)) { seen.add(key); violations.push({ sentence, rule }); }
  };
  const needs = rawNeedUnits(source);
  for (const unit of copyUnits(text)) {
    for (const [rule, pattern] of DISCRETION_PATTERNS)
      if (pattern.test(unit)) flag(unit, rule);
    if (HELP_US_RAISE.test(unit) && MONEY_OBJECT.test(unit)) flag(unit, "amount_pleading");
    // Raw-need echo: the generated line restates a need the organizer
    // declared, whatever words it wears — the need itself is the leak.
    if (needs.length && RAW_NEED_STATEMENT.test(unit) &&
        needs.some(need => nearSame(unit, need)))
      flag(unit, "need_echo");
  }
  return violations;
}
/**
 * Scan a whole generated draft (or a single section) and return every
 * discretion violation tagged with the field it appears in, so the caller
 * can correct, strip or fail closed field by field.
 */
export function findCampaignCopyDiscretionViolations(output, source, section = false) {
  if (section)
    return findPublicFacingViolations(output?.section, source)
      .map(v => ({ field: "section", ...v }));
  const found = [];
  (Array.isArray(output?.titles) ? output.titles : []).forEach((title, index) =>
    findPublicFacingViolations(title, source).forEach(v => found.push({ field: "titles", index, ...v })));
  (Array.isArray(output?.summaries) ? output.summaries : []).forEach((summary, index) =>
    findPublicFacingViolations(summary, source).forEach(v => found.push({ field: "summaries", index, ...v })));
  findPublicFacingViolations(output?.story, source)
    .forEach(v => found.push({ field: "story", ...v }));
  return found;
}
/**
 * Remove violating sentences from long-form copy (story or section),
 * paragraph by paragraph. Short fields (titles, summaries) cannot be
 * stripped without breaking their shape; callers fail closed on those
 * instead of shipping a banned line.
 */
export function stripPublicFacingViolations(text, source) {
  return String(text || "").split(/\n{2,}/).map(paragraph => {
    const kept = copyUnits(paragraph)
      .filter(unit => findPublicFacingViolations(unit, source).length === 0);
    return kept.join(" ");
  }).filter(Boolean).join("\n\n");
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
    fit(`Why support matters for ${audience}`),
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
