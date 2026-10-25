// Shared AI helpers for campaign content generation.
// Compliance safeguards + a full campaign context builder used by every
// AI feature so the model always understands the complete campaign before
// generating anything. Kept truthful and never invents facts.

export const COMPLIANCE_RULES = `Compliance and safety requirements (non-negotiable):
- Never fabricate, guess, or invent any campaign information, facts, statistics, beneficiary details, deadlines, or outcomes.
- Only use information explicitly provided in the campaign context. If something is unknown, omit it rather than invent it.
- Never create false urgency, misrepresent facts, or promise outcomes that cannot be guaranteed.
- Never use language that harasses, spams, pressures, or exploits vulnerable donors.
- Respect privacy: do not invent personal details about beneficiaries.
- Keep all claims truthful and verifiable from the provided context.
- Do not change any detail the creator marked as "never change".`;

export const STORY_STYLES = [
  { value: "emotional", label: "Emotional storytelling", description: "Human-centered and empathetic", guidance: "Open with the human stakes, use warm concrete language, connect the need to its real-life impact, and end with a hopeful specific invitation to help. Do not exaggerate emotion or invent hardship." },
  { value: "factual", label: "Factual presentation", description: "Clear, specific, and transparent", guidance: "Lead with the need and purpose, organize verified facts logically, explain how funds will be used, minimize emotional adjectives, and end with a direct evidence-grounded call to action." },
  { value: "urgent", label: "Urgency", description: "Time-aware without pressure", guidance: "Lead with any real deadline or time-sensitive need present in the facts, use concise active sentences, explain what timely support changes, and end with an immediate but non-coercive action. Never manufacture urgency." },
  { value: "professional", label: "Professional", description: "Credible and organized", guidance: "Use composed language, a clear problem-plan-impact structure, transparent funding purpose, restrained emotion, and a confident professional invitation suitable for institutions or formal supporters." },
  { value: "community", label: "Community involvement", description: "Collective and participatory", guidance: "Frame the campaign around shared impact and participation, show how individuals and groups can contribute, use inclusive language without assuming identity or affiliation, and end with donation, sharing, or connection options." },
];

export function styleGuidance(value) {
  return STORY_STYLES.find((s) => s.value === value)?.guidance || STORY_STYLES[0].guidance;
}

export const AUDIENCES = [
  { value: "general", label: "General public" },
  { value: "previous_donors", label: "Previous donors" },
  { value: "corporate_sponsors", label: "Corporate sponsors" },
  { value: "community_groups", label: "Community groups" },
  { value: "faith", label: "Faith communities" },
];

const PRIORITY_LABELS = {
  emotional: "emotional storytelling",
  factual: "factual presentation",
  urgent: "urgency",
  professional: "professionalism",
  community: "community involvement",
};

// Build a complete, truthful context string from a campaign + its AI profile.
// `campaign` is the entity record; `aiProfile` is campaign.ai_profile.
export function buildCampaignContext(campaign, aiProfile = {}) {
  const lines = [];
  if (campaign.title) lines.push(`Title: ${campaign.title}`);
  if (campaign.category) lines.push(`Category: ${campaign.category}`);
  if (campaign.summary) lines.push(`Summary: ${campaign.summary}`);
  if (campaign.story) lines.push(`Current story: ${campaign.story}`);
  if (campaign.goal_amount) lines.push(`Goal amount: $${campaign.goal_amount}`);
  if (campaign.raised_amount != null) lines.push(`Raised so far: $${campaign.raised_amount || 0}`);
  if (campaign.donor_count != null) lines.push(`Donor count: ${campaign.donor_count || 0}`);
  if (campaign.end_date) lines.push(`End date: ${campaign.end_date}`);
  if (campaign.cover_image_url) lines.push(`Has cover image: yes`);

  const p = aiProfile || {};
  if (p.primary_goal) lines.push(`Primary fundraising goal: ${p.primary_goal}`);
  if (p.who_helping) lines.push(`Who this helps: ${p.who_helping}`);
  if (p.ideal_donors) lines.push(`Creator-suggested donor possibilities (hypothesis, not a restriction): ${p.ideal_donors}`);
  if (p.donor_discovery_mode === "ai_research") lines.push("Audience discovery: AI should independently identify and test plausible supporter audiences from campaign facts; creator suggestions are optional hypotheses.");
  if (p.donor_discovery_notes) lines.push(`Audience discovery context/boundaries: ${p.donor_discovery_notes}`);
  if (p.tone) lines.push(`Preferred tone: ${p.tone}`);
  if (p.priority) lines.push(`Priority approach: ${PRIORITY_LABELS[p.priority] || p.priority}`);
  if (p.always_emphasize) lines.push(`Always emphasize: ${p.always_emphasize}`);
  if (p.never_change) lines.push(`Never change: ${p.never_change}`);
  if (p.avoid_words) lines.push(`Words/topics to avoid: ${p.avoid_words}`);
  if (p.interested_orgs) lines.push(`Interested organizations/communities/industries: ${p.interested_orgs}`);
  if (p.platforms && p.platforms.length) lines.push(`Sharing platforms: ${p.platforms.join(", ")}`);
  if (p.long_term_outcome) lines.push(`Long-term outcome: ${p.long_term_outcome}`);

  return lines.length ? lines.join("\n") : "No campaign context available yet.";
}

export function styleLabel(value) {
  return STORY_STYLES.find((s) => s.value === value)?.label || value;
}

export function styleDescription(value) {
  return STORY_STYLES.find((s) => s.value === value)?.description || "";
}

export function audienceLabel(value) {
  return AUDIENCES.find((a) => a.value === value)?.label || value;
}