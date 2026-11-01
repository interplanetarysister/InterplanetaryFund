/*
 * Interplanetary Fund — credit-free owned generators.
 *
 * These functions intentionally avoid Base44 AI, hosted LLM/image-generation,
 * Browserbase, or other metered inference APIs. They are deterministic and run
 * inside the Interplanetary Fund application. Metered providers may be added as
 * optional adapters elsewhere, but must never be required for these outcomes.
 */

const clean = (value, fallback = "") => String(value ?? fallback).trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sentence = (text) => {
  const value = clean(text).replace(/\s+/g, " ");
  if (!value) return "";
  return /[.!?]$/.test(value) ? value : `${value}.`;
};

const splitSentences = (text) => clean(text)
  .replace(/\s+/g, " ")
  .split(/(?<=[.!?])\s+/)
  .map((item) => item.trim())
  .filter(Boolean);

const words = (text) => clean(text).toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
const STOP = new Set([
  "the", "and", "that", "with", "from", "this", "have", "will", "your", "you", "for", "are",
  "was", "were", "their", "they", "our", "about", "into", "but", "not", "has", "had", "can",
  "its", "who", "what", "when", "where", "why", "how", "than", "then", "them", "these", "those",
]);

const topKeywords = (text, limit = 5) => {
  const counts = new Map();
  for (const word of words(text)) {
    if (STOP.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
};

const esc = (text) => clean(text)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const stableHash = (text) => {
  let hash = 2166136261;
  for (const char of clean(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export function generateCampaignCoverDataUrl({ title, category, regenCount = 0 } = {}) {
  const campaignTitle = clean(title, "Interplanetary Fund Campaign");
  const campaignCategory = clean(category, "Community Support");
  const seed = stableHash(`${campaignTitle}|${campaignCategory}|${regenCount}`);
  // Credit-free covers still use the recognizable IFund cyan/violet galaxy
  // palette; variation changes composition, not the platform's identity.
  const hueA = seed % 2 ? 191 + (seed % 26) : 240 + (seed % 28);
  const hueB = 273 + (seed % 27);
  const shortTitle = campaignTitle.length > 62 ? `${campaignTitle.slice(0, 59)}…` : campaignTitle;
  const shortCategory = campaignCategory.length > 42 ? `${campaignCategory.slice(0, 39)}…` : campaignCategory;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${esc(campaignTitle)} campaign cover"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hueA} 68% 36%)"/><stop offset="1" stop-color="hsl(${hueB} 72% 24%)"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="1325" cy="160" r="240" fill="white" opacity=".08"/><circle cx="140" cy="760" r="310" fill="white" opacity=".06"/><g fill="none" stroke="white" opacity=".17"><ellipse cx="1320" cy="280" rx="250" ry="70" transform="rotate(-23 1320 280)" stroke-width="5"/><ellipse cx="1320" cy="280" rx="250" ry="70" transform="rotate(32 1320 280)" stroke-width="2"/><circle cx="1320" cy="280" r="108" stroke-width="3"/><circle cx="1320" cy="280" r="139" stroke-dasharray="8 18" stroke-width="3"/></g><path d="M0 880H1600M40 0V900M1560 0V900" stroke="#67e8f9" stroke-opacity=".24" stroke-width="9"/><g stroke="#22d3ee" stroke-opacity=".15" fill="none" stroke-width="4"><path d="M0 550h95l55 65h175l55-50h88"/><path d="M1600 650h-155l-49 45h-110l-30 60"/><path d="M950 0v100l65 30h180"/></g><path d="M35 35h120M35 35v110M1565 35h-120M1565 35v110M35 865h120M35 865v-110M1565 865h-120M1565 865v-110" stroke="#a78bfa" stroke-opacity=".52" stroke-width="9" fill="none"/><text x="120" y="145" fill="white" opacity=".82" font-family="Arial,Helvetica,sans-serif" font-size="34" font-weight="700" letter-spacing="4">INTERPLANETARY FUND</text><text x="120" y="405" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="76" font-weight="700">${esc(shortTitle)}</text><text x="120" y="485" fill="white" opacity=".86" font-family="Arial,Helvetica,sans-serif" font-size="36">${esc(shortCategory)}</text><text x="120" y="760" fill="white" opacity=".75" font-family="Arial,Helvetica,sans-serif" font-size="30">Endless possibilities start with one question: What if?</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generateMissionRecommendations(campaigns = []) {
  const list = Array.isArray(campaigns) ? campaigns : [];
  if (!list.length) {
    return [{
      title: "Create your first campaign",
      description: "Add a clear goal, story, image, and funding target so Interplanetary Fund can begin tracking progress and outreach readiness.",
      priority: "high",
      action: "Create campaign",
    }];
  }

  const recommendations = [];
  const active = list.filter((c) => clean(c.status).toLowerCase() === "active");
  const noStory = list.find((c) => clean(c.story || c.description).length < 180);
  const noImage = list.find((c) => !clean(c.image_url || c.imageUrl || c.cover_image || c.coverImage));
  const stalled = active.find((c) => {
    const goal = number(c.goal_amount ?? c.goalAmount);
    const raised = number(c.raised_amount ?? c.raisedAmount);
    return goal > 0 && raised / goal < 0.25;
  });
  const nearGoal = active.find((c) => {
    const goal = number(c.goal_amount ?? c.goalAmount);
    const raised = number(c.raised_amount ?? c.raisedAmount);
    const ratio = goal > 0 ? raised / goal : 0;
    return ratio >= 0.75 && ratio < 1;
  });

  if (nearGoal) recommendations.push({
    title: `Finish the final stretch for ${clean(nearGoal.title, "your campaign")}`,
    description: "This campaign is at least 75% funded. Publish a concise progress update with the remaining amount and a specific share request.",
    priority: "high",
    action: "Post progress update",
    campaignId: nearGoal.id,
  });
  if (stalled) recommendations.push({
    title: `Refresh outreach for ${clean(stalled.title, "an active campaign")}`,
    description: "Funding is below 25% of goal. Re-share the strongest impact statement, explain the next concrete milestone, and ask existing supporters to forward the campaign.",
    priority: "high",
    action: "Refresh outreach",
    campaignId: stalled.id,
  });
  if (noStory) recommendations.push({
    title: "Strengthen a campaign story",
    description: `Add who the campaign helps, why the need matters now, how funds will be used, and what changes when the goal is reached${noStory?.title ? ` for ${noStory.title}` : ""}.`,
    priority: "medium",
    action: "Improve story",
    campaignId: noStory.id,
  });
  if (noImage) recommendations.push({
    title: "Add a clear campaign cover",
    description: "A recognizable cover makes campaign links easier to understand and share. Use an owned campaign graphic or uploaded image.",
    priority: "medium",
    action: "Add cover image",
    campaignId: noImage.id,
  });
  if (!recommendations.length) recommendations.push({
    title: "Publish a supporter update",
    description: "Your campaign basics are in place. Share what changed recently, thank supporters, and give one specific next action.",
    priority: "medium",
    action: "Post update",
  });
  return recommendations.slice(0, 4);
}

export function draftInboxReply(item = {}, platformLabel = "Interplanetary Fund") {
  const sender = clean(item.author || item.sender_name || item.senderName || item.from_name || item.fromName, "there");
  const subject = clean(item.subject || item.title);
  const body = clean(item.body || item.message || item.content);
  const gratitude = /donat|gift|support|contribut|pledge/i.test(`${subject} ${body}`)
    ? "Thank you for your support. It means a great deal to the campaign."
    : "Thank you for reaching out.";
  const response = body
    ? "I received your message and will make sure the relevant campaign details are reviewed."
    : "I received your message and will follow up with the relevant campaign details.";
  return `Hi ${sender},\n\n${gratitude} ${response}\n\nIf there is a specific detail you need from us, please reply with it and we will address it directly.\n\nBest,\n${platformLabel}`;
}

export function draftGrantApplication({ opportunity = {}, institution = {}, campaign = {} } = {}) {
  const institutionName = clean(institution.name || opportunity.institution_name || opportunity.institutionName, "Grant Review Committee");
  const campaignTitle = clean(campaign.title, "our campaign");
  const goal = number(campaign.goal_amount ?? campaign.goalAmount);
  const category = clean(campaign.category, "community impact");
  const purpose = sentence(campaign.summary || campaign.description || campaign.story || `This campaign supports ${category}.`);
  const amountText = goal > 0 ? ` Our current funding goal is $${goal.toLocaleString()}.` : "";
  return {
    draftSubject: `Funding application: ${campaignTitle}`,
    draftGreeting: `Dear ${institutionName},`,
    draftBody: `${purpose}${amountText}\n\nWe are seeking support because the requested funding will be directed toward the campaign's stated needs and tracked through Interplanetary Fund. We will provide progress updates and maintain a clear record of how the campaign advances toward its goal.\n\nThank you for considering this request. We would be glad to provide any additional information required for your review.`,
    draftClosing: "Sincerely,\nInterplanetary Fund campaign team",
  };
}

export function summarizeDocument({ title = "Document", content = "" } = {}) {
  const text = clean(content);
  if (!text) return { summary: `${clean(title, "Document")} has no readable text to summarize.`, key_points: [], topics: [] };
  const sentences = splitSentences(text);
  const summary = sentences.slice(0, 3).join(" ").slice(0, 900) || text.slice(0, 900);
  const key_points = (sentences.length ? sentences : [text]).slice(0, 5).map((item) => item.slice(0, 240));
  const topics = topKeywords(text, 6);
  return { summary, key_points, topics };
}

export function draftCommunication({ typeLabel = "outreach message", campaign = {} } = {}) {
  const title = clean(campaign.title, "our campaign");
  const summary = sentence(campaign.summary || campaign.description || campaign.story || "We are raising support for an important need");
  const goal = number(campaign.goal_amount ?? campaign.goalAmount);
  const raised = number(campaign.raised_amount ?? campaign.raisedAmount);
  const progress = goal > 0 ? ` We have raised $${raised.toLocaleString()} toward a $${goal.toLocaleString()} goal.` : "";
  return `Hello,\n\nI’m reaching out about ${title}. ${summary}${progress}\n\nIf this mission resonates with you, please consider supporting the campaign or sharing it with someone who may want to help. Every meaningful connection can move the campaign forward.\n\nThank you for taking the time to read this ${clean(typeLabel, "message")}.
`;
}

export function buildExecutiveReport({ reportTypeLabel = "Campaign report", campaigns = [], donations = [], expenses = [], migrations = [] } = {}) {
  const campaignList = Array.isArray(campaigns) ? campaigns : [];
  const donationList = Array.isArray(donations) ? donations : [];
  const expenseList = Array.isArray(expenses) ? expenses : [];
  const migrationList = Array.isArray(migrations) ? migrations : [];
  const totalGoal = campaignList.reduce((sum, c) => sum + number(c.goal_amount ?? c.goalAmount), 0);
  const reportedRaised = campaignList.reduce((sum, c) => sum + number(c.raised_amount ?? c.raisedAmount), 0);
  const donationTotal = donationList.reduce((sum, d) => sum + number(d.amount), 0);
  const totalRaised = Math.max(reportedRaised, donationTotal);
  const totalExpenses = expenseList.reduce((sum, e) => sum + number(e.amount), 0);
  const completion = totalGoal > 0 ? clamp((totalRaised / totalGoal) * 100, 0, 999) : 0;
  const ranked = [...campaignList].sort((a, b) => number(b.raised_amount ?? b.raisedAmount) - number(a.raised_amount ?? a.raisedAmount));
  const executiveSummary = `${reportTypeLabel}: ${campaignList.length} campaign${campaignList.length === 1 ? "" : "s"} tracked, $${totalRaised.toLocaleString()} raised${totalGoal > 0 ? ` toward $${totalGoal.toLocaleString()} in stated goals` : ""}, with $${totalExpenses.toLocaleString()} in recorded expenses.`;
  const recommendations = generateMissionRecommendations(campaignList).map((item) => item.description);
  const highlights = [
    `$${totalRaised.toLocaleString()} raised across ${donationList.length} recorded donation${donationList.length === 1 ? "" : "s"}.`,
    `${campaignList.filter((c) => clean(c.status).toLowerCase() === "active").length} campaign${campaignList.length === 1 ? "" : "s"} currently active.`,
    totalGoal > 0 ? `${completion.toFixed(1)}% aggregate progress against stated campaign goals.` : "Campaign activity is being tracked even where no aggregate goal is available.",
  ];
  const concerns = [];
  if (totalGoal > 0 && completion < 25) concerns.push("Aggregate funding is below 25% of stated goals; prioritize campaigns with the largest remaining gap.");
  if (donationList.length === 0) concerns.push("No donation records are present in this reporting snapshot; verify campaign visibility and donation-path readiness.");
  if (!concerns.length) concerns.push("No critical numerical warning is visible in this snapshot; continue monitoring campaign-level progress and supporter activity.");
  const forecast = totalGoal > 0
    ? `Current progress is ${completion.toFixed(1)}% of stated goals. Future fundraising cannot be guaranteed; use current campaign momentum and recent activity as directional evidence only.`
    : "There is not enough goal data for a numeric projection. Future fundraising cannot be guaranteed.";
  return {
    summary: executiveSummary,
    highlights,
    concerns,
    forecast,
    recommended_actions: recommendations,
    executive_summary: executiveSummary,
    key_metrics: [
      { label: "Campaigns", value: campaignList.length },
      { label: "Raised", value: totalRaised },
      { label: "Goal completion", value: `${completion.toFixed(1)}%` },
      { label: "Donations", value: donationList.length },
      { label: "Expenses", value: totalExpenses },
      { label: "Migration records", value: migrationList.length },
    ],
    campaign_performance: ranked.slice(0, 8).map((campaign) => ({
      title: clean(campaign.title, "Untitled campaign"),
      raised: number(campaign.raised_amount ?? campaign.raisedAmount),
      goal: number(campaign.goal_amount ?? campaign.goalAmount),
      status: clean(campaign.status, "unknown"),
    })),
    top_recommendations: recommendations,
  };
}

export function generateCampaignStory({ form = {}, style = "clear", audience = "general supporters", seo = false, accessibility = false, refine = false, existing = "" } = {}) {
  const title = clean(form.title, "A campaign worth supporting");
  const category = clean(form.category, "community support");
  const goal = number(form.goal_amount ?? form.goalAmount ?? form.goal);
  const beneficiary = clean(form.beneficiary || form.who_it_helps || form.whoItHelps, "the people this campaign is designed to support");
  const need = sentence(form.need || form.problem || form.description || form.summary || existing || `This campaign addresses an important ${category} need`);
  const use = sentence(form.use_of_funds || form.useOfFunds || form.fund_usage || "Funds will be used directly for the needs described by the campaign");
  const urgency = sentence(form.urgency || form.why_now || form.whyNow || "Support now helps move the campaign from need to action");
  const impact = sentence(form.impact || form.outcome || `Reaching the goal will create measurable progress for ${beneficiary}`);
  const tone = clean(style, "clear");
  const goalText = goal > 0 ? `Our goal is $${goal.toLocaleString()}, and every contribution moves us closer to the resources needed to act.` : "Every contribution moves the campaign closer to the resources needed to act.";
  const accessLine = accessibility ? "The plan is described plainly so supporters can understand where help is going and what progress looks like." : "Supporters will receive clear progress updates as the campaign moves forward.";
  const seoLine = seo ? `This ${category} fundraising campaign is built to connect people who want to help with a specific, transparent need.` : "This campaign is built to connect people who want to help with a specific, transparent need.";
  const refineLine = refine && clean(existing) ? "This revised version keeps the original purpose while making the need, use of funds, and next action clearer." : "";
  return `${title}\n\n${need}\n\n${urgency} ${goalText}\n\n${use} ${accessLine}\n\n${impact} ${seoLine}\n\nWe are asking ${audience} to help by donating, sharing the campaign, or connecting us with people and organizations that may care about this mission. The intended tone is ${tone}: direct about the need, transparent about the goal, and focused on the real-world outcome.${refineLine ? `\n\n${refineLine}` : ""}`;
}

export function generateCampaignTips(campaign = {}, updatesCount = 0) {
  const title = clean(campaign.title, "your campaign");
  const goal = number(campaign.goal_amount ?? campaign.goalAmount);
  const raised = number(campaign.raised_amount ?? campaign.raisedAmount);
  const ratio = goal > 0 ? raised / goal : 0;
  const tips = [];
  if (goal > 0) tips.push(`${title} is ${clamp(ratio * 100, 0, 999).toFixed(0)}% of the way to its funding goal. Lead your next update with the exact remaining amount.`);
  if (!clean(campaign.story || campaign.description) || clean(campaign.story || campaign.description).length < 180) tips.push("Strengthen the story with four specifics: who needs help, why now, exactly how funds are used, and what success changes.");
  if (!clean(campaign.image_url || campaign.imageUrl || campaign.cover_image || campaign.coverImage)) tips.push("Add a recognizable campaign cover so shared links are immediately understandable.");
  if (updatesCount < 1) tips.push("Publish a first progress update, even if the campaign is new. Early updates give supporters something current to share.");
  if (ratio >= 0.75 && ratio < 1) tips.push("You are in the final stretch. Ask supporters to share the remaining gap rather than repeating the full original goal.");
  if (ratio < 0.25) tips.push("Test one new outreach audience and one new message angle, then compare which produces more visits, shares, or donations.");
  if (!tips.length) tips.push("Keep momentum by thanking recent supporters, reporting one concrete change, and ending with one specific action people can take next.");
  return tips.slice(0, 4);
}
