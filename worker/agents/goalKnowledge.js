// "Refine Knowledge About Your Goal" (owner directive 2026-11-26).
//
// When a member submits a plan or discusses one with the team, they can give
// the agents extra time to research that specific kind of goal: the easiest
// and fastest way to achieve it, in line with the member's own requirements
// and priorities, and the best-kept practices for that category — especially
// as they relate to the services iFund itself offers.
//
// Design rules (owner directive 2026-11-26, second message):
// - Do NOT limit the team's knowledge or capability. The plan is available
//   to every agent the member talks to (it is recorded in the shared,
//   owner-scoped team context all specialists read), covers every knowledge
//   area below for every category, and draws on the full allowlisted
//   professional-practice source set — not a per-agent subset.
// - The member's private details stay private: research questions are
//   category-level, no private user data is sent to external sources, and
//   anything reused for future campaigns is anonymized and gated behind
//   super-admin approval before it can influence anyone else.
//
// Honesty contract (same as chief-of-staff dispatch): building a plan is
// PREPARATION. It is not completed research, it performs no external
// actions, and statuses here must never be upgraded beyond "prepared" by
// this module. A brief becomes "researched" only when a real research run
// produces one and it is saved to the member's private space.
import { redactTeamCredentials } from "./teamContext.js";

export const GOAL_KNOWLEDGE_LABEL = "Refine Knowledge About Your Goal";
export const GOAL_KNOWLEDGE_VERSION = "2026-11-26-v1";

// Every knowledge area is researched for every goal. Nothing is withheld
// from a category because an agent "doesn't need it".
export const GOAL_KNOWLEDGE_AREAS = Object.freeze([
  "fastest_path",            // quickest credible route to the goal
  "easiest_path",            // lowest-friction route for this member
  "requirements_priorities", // fit to the member's stated needs and limits
  "category_best_practice",  // what works for this kind of goal
  "benchmarks",              // realistic amounts, timelines, milestones
  "story_and_influence",     // truthful psychological-influence angles
  "marketing_and_social",    // channels and social techniques that fit
  "ifund_services_fit",      // how iFund's own tools serve this goal
  "alternatives_and_grants", // non-donation routes worth knowing about
  "risks_and_claims",        // failure patterns and claims to avoid
]);

export const GOAL_BRIEF_SECTIONS = Object.freeze([
  "fastest_path", "easiest_path", "requirements_and_priorities",
  "amount_and_timeline", "story_and_influence_angles", "marketing_plan",
  "ifund_services_plan", "risks_and_claims_to_avoid", "publish_checklist",
]);

// The full allowlisted professional-practice source set (see
// agentResearchTool.mjs). Refinement is not restricted to one agent's
// subset: the whole team benefits from the whole set.
export const GOAL_KNOWLEDGE_SOURCE_IDS = Object.freeze([
  "ethics", "transparency", "planning", "outreach",
]);

// Broad category signals aligned with CAMPAIGN_CATEGORIES, plus a general
// fallback so an unrecognized goal still gets a full research plan — an
// unknown category narrows nothing.
const CATEGORY_SIGNALS = Object.freeze({
  medical: ["medical", "hospital", "surgery", "treatment", "illness", "cancer", "therapy", "health", "clinic", "dental"],
  emergency: ["emergency", "urgent", "eviction", "shutoff", "crisis", "immediate"],
  education: ["education", "school", "tuition", "student", "scholarship", "college", "classroom"],
  community: ["community", "neighborhood", "church", "food bank", "shelter", "local", "volunteer"],
  animals: ["animal", "dog", "cat", "pet", "rescue", "wildlife", "shelter animal"],
  business: ["business", "startup", "small business", "shop", "company", "entrepreneur"],
  creative: ["creative", "film", "music", "album", "book", "art", "game", "podcast"],
  memorial: ["memorial", "funeral", "burial", "in memory", "passed away"],
  disaster_relief: ["disaster", "fire", "flood", "hurricane", "earthquake", "storm damage", "wildfire"],
  environment: ["environment", "climate", "conservation", "ocean", "forest", "cleanup", "solar"],
});

const normalize = value => String(value || "").normalize("NFKC").toLocaleLowerCase("en-US")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function detectGoalCategory(text) {
  const padded = " " + normalize(text) + " ";
  for (const [category, signals] of Object.entries(CATEGORY_SIGNALS)) {
    if (signals.some(signal => padded.includes(" " + normalize(signal) + " "))) return category;
  }
  return "general";
}

const REFINE_PHRASES = [
  "refine knowledge", "deep research", "research my goal", "research this goal",
  "research my campaign", "research this campaign", "research my plan",
  "research this plan", "research how to", "do research on", "investigate",
  "look into the best way", "find out the best way", "learn more about my goal",
];
// A plain mention of research about a goal/plan/campaign also counts; the
// member should never need magic words to get a fully informed team.
export function detectRefineKnowledgeIntent(question) {
  const text = " " + normalize(question) + " ";
  if (REFINE_PHRASES.some(phrase => text.includes(" " + normalize(phrase) + " "))) return true;
  return text.includes(" research ") &&
    ["goal", "campaign", "plan", "fundraiser", "fundraising"].some(word => text.includes(" " + word + " "));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Own team-context idempotency key, distinct from the message, reply and
// dispatch keys (different bits toggled; see chiefOfStaffDispatch.js).
export function refineEventKey(requestId) {
  if (!UUID.test(requestId || "")) throw Error("Invalid request reference.");
  const bits = requestId.replace(/-/g, "").split("");
  bits[13] = (parseInt(bits[13], 16) ^ 2).toString(16);
  const tail = bits.slice(20).join("");
  const changed = tail[0] + (parseInt(tail[1], 16) ^ 4).toString(16) + tail.slice(2);
  return bits.slice(0, 8).join("") + "-" + bits.slice(8, 12).join("") + "-" +
    bits.slice(12, 16).join("") + "-" + bits.slice(16, 20).join("") + "-" + changed;
}

// Subject identity (context-isolation repair, owner report 2026-11-27):
// a member can refine SEVERAL goals, and knowledge refined for one goal
// must never be silently applied to a discussion about another. Every plan
// therefore records which campaign/goal it belongs to: the campaign id
// when the flow knows it, otherwise a goal fingerprint (normalized goal
// title + category) captured when the plan is prepared. The title comes
// from the request when supplied, else from the member's own naming of the
// goal in the refine request ("Deep research my goal: surgery bills").
// Extraction is deliberately conservative: no explicit naming, no title —
// an unattributed plan may still be offered later, but only labelled as
// belonging to an earlier goal, never as the current topic's knowledge.
const TITLE_PATTERNS = Object.freeze([
  /(?:deep\s+research|research|refine(?:\s+knowledge)?(?:\s+about)?)\s+(?:my|this|the)\s+(?:goal|campaign|plan|fundraiser)\s*[:\-–—]\s*(.+)$/i,
  /(?:my|this)\s+(?:goal|campaign|plan|fundraiser)\s*[:\-–—]\s*(.+)$/i,
  /(?:goal|campaign|plan)\s*[:\-–—]\s*(.+)$/i,
]);
export function extractGoalTitle(text) {
  const raw = String(text || "");
  for (const pattern of TITLE_PATTERNS) {
    const match = raw.match(pattern);
    if (!match) continue;
    const cleaned = match[1].replace(/\s+/g, " ").replace(/[\s.?!…]+$/u, "").trim().slice(0, 120);
    const normalized = normalize(cleaned);
    if (normalized.length >= 3 && !/^(it|this|that|my goal|my campaign|my plan)$/.test(normalized))
      return cleaned;
  }
  return null;
}

export function goalFingerprint(goalTitle, category) {
  const title = normalize(goalTitle || "");
  return title ? title + "|" + (category || "general") : null;
}

// The subject block recorded on every new plan. Legacy plans (prepared
// before this repair) have no subject block: they are attributable only
// through their team-context event's campaign_id, if any.
export function buildGoalSubject({ question = "", category = "general", campaignId = null, goalTitle = null } = {}) {
  const explicit = typeof goalTitle === "string" && goalTitle.trim()
    ? goalTitle.replace(/\s+/g, " ").trim().slice(0, 120) : null;
  const title = explicit || extractGoalTitle(question);
  return {
    campaign_id: UUID.test(campaignId || "") ? campaignId : null,
    goal_title: title,
    category,
    fingerprint: goalFingerprint(title, category),
  };
}

export function goalSubjectLabel(subject) {
  if (!subject) return "an earlier goal";
  const title = subject.goal_title || subject.title;
  if (typeof title === "string" && title.trim()) return '"' + title.trim() + '"';
  const category = subject.category;
  return category && category !== "general" && category !== "other"
    ? `a ${String(category).replace(/_/g, " ")} goal`
    : "an earlier goal";
}

export function buildGoalKnowledgePlan({ question = "", category = null, origin = "chat", campaignId = null, goalTitle = null } = {}) {
  const resolvedCategory = category || detectGoalCategory(question);
  const subject = resolvedCategory === "general" ? "this kind of goal" : `a ${resolvedCategory.replace(/_/g, " ")} goal`;
  return {
    kind: "goal_knowledge_refinement",
    version: GOAL_KNOWLEDGE_VERSION,
    label: GOAL_KNOWLEDGE_LABEL,
    status: "prepared",
    origin,
    category: resolvedCategory,
    subject: buildGoalSubject({ question, category: resolvedCategory, campaignId, goalTitle }),
    // Category-level questions only: the member's personal story and
    // circumstances are never part of what gets researched externally.
    research_questions: [
      `What is the fastest credible way to achieve ${subject}, step by step?`,
      `What is the easiest, lowest-friction way to achieve ${subject} for someone with this member's stated requirements and priorities?`,
      `What are the best-kept practices for ${subject} — what do successful efforts do that struggling ones do not?`,
      `What amounts, timelines and milestones are realistic for ${subject}, and what proof builds supporter trust?`,
      `Which truthful story angles and psychological-influence techniques fit ${subject} and its audience?`,
      `Which marketing and social-media techniques work best for ${subject}, and how do iFund's own services (campaign pages, Story, Shorts, donor matching, sharing) serve each step?`,
      `What grants, sponsorships, earned-income or noncash alternatives exist for ${subject} beyond donations?`,
      `What are the common failure patterns, risks and claims to avoid for ${subject}?`,
    ],
    knowledge_areas: [...GOAL_KNOWLEDGE_AREAS],
    brief_sections: [...GOAL_BRIEF_SECTIONS],
    practice_source_ids: [...GOAL_KNOWLEDGE_SOURCE_IDS],
    estimated_minutes: 2,
    brief_expires_after_days: 90,
    save_to_private_space: true,
    // The whole team reads the brief through shared team context; no agent
    // is walled off from what another agent learned for this member.
    shared_with_team: true,
    cross_campaign_learning: {
      anonymized_only: true,
      requires_super_admin_approval: true,
      training_promoted: false,
    },
    private_user_data_sent_externally: false,
    research_completed: false,
    actions_performed: false,
  };
}

// Tier gate (owner directive 2026-11-26): in-depth goal research is a
// subscriber-tier advantage, also available to verified admin/super-admin.
// The authoritative source is the server-side ifund_story_subscription()
// RPC, read with the member's own JWT — never the browser's or the member's
// say-so. It returns {tier, level, status, active, admin_granted}, where a
// verified admin (including super-admin) is enterprise level 4 with
// admin_granted=true, a paying subscriber is active with level>=1, and a
// free account is level 0. Anything missing or malformed fails CLOSED to
// free: an unverifiable tier never grants the advantage.
export function classifyMemberAccess(subscription) {
  const tier = typeof subscription?.tier === "string" &&
    /^[a-z_]{1,24}$/.test(subscription.tier) ? subscription.tier : "free";
  const level = Number.isInteger(subscription?.level) ? subscription.level : 0;
  if (subscription?.admin_granted === true)
    return { kind: "admin", eligible: true, tier, level, verified: true };
  if (subscription?.active === true && level >= 1)
    return { kind: "subscriber", eligible: true, tier, level, verified: true };
  return { kind: "free", eligible: false, tier, level, verified: subscription != null };
}

// Reference & application: when a refinement was recorded earlier in the
// member's shared team context, later conversations must be able to find it
// and apply it. History events carry the plan as JSON content. Team-context
// reads return events NEWEST-first (ifund_team_recent orders by recorded_at
// desc), so "latest" is decided by recorded_at, never by array position —
// a member who refined two different goals gets the most recent plan.
// Returns null when nothing usable is on file.
export function extractGoalKnowledgeFromHistory(events) {
  if (!Array.isArray(events)) return null;
  let best = null, bestTime = -Infinity;
  for (const event of events) {
    const content = event?.content;
    if (typeof content !== "string" || !content.includes("goal_knowledge_refinement")) continue;
    try {
      const parsed = JSON.parse(content);
      const plan = parsed?.goal_knowledge_refinement;
      if (!plan || plan.kind !== "goal_knowledge_refinement" || plan.status !== "prepared") continue;
      const time = Date.parse(event.recorded_at || "");
      const stamp = Number.isFinite(time) ? time : 0;
      if (stamp >= bestTime) { best = plan; bestTime = stamp; }
    } catch { /* not a plan record; keep scanning */ }
  }
  return best;
}

// Every prepared plan in a history window, newest first, with the team
// event's own campaign association kept beside it: a plan recorded before
// subject blocks existed can still be attributed through its event.
export function parseGoalKnowledgePlans(events) {
  if (!Array.isArray(events)) return [];
  const found = [];
  events.forEach((event, index) => {
    const content = event?.content;
    if (typeof content !== "string" || !content.includes("goal_knowledge_refinement")) return;
    try {
      const parsed = JSON.parse(content);
      const plan = parsed?.goal_knowledge_refinement;
      if (!plan || plan.kind !== "goal_knowledge_refinement" || plan.status !== "prepared") return;
      const time = Date.parse(event.recorded_at || "");
      found.push({ plan, recorded_at: event.recorded_at || null,
        event_campaign_id: UUID.test(event.campaign_id || "") ? event.campaign_id : null,
        stamp: Number.isFinite(time) ? time : 0, index });
    } catch { /* not a plan record; keep scanning */ }
  });
  // Newest first; on identical stamps the later event in the window wins,
  // mirroring extractGoalKnowledgeFromHistory's tie behaviour.
  return found.sort((a, b) => (b.stamp - a.stamp) || (b.index - a.index));
}

const categoryCompatible = (a, b) =>
  !a || !b || a === "general" || b === "general" || a === "other" || b === "other" || a === b;

// Does this on-file plan belong to the subject under discussion? Campaign
// identity wins outright; otherwise the goal fingerprint (normalized title,
// category-compatible) must match. A plan that cannot be attributed to the
// subject never matches it — that is the isolation guarantee.
export function goalKnowledgeMatchesSubject(entry, subject) {
  if (!entry?.plan || !subject) return false;
  const planSubject = entry.plan.subject || {};
  if (subject.campaign_id &&
      (planSubject.campaign_id === subject.campaign_id ||
       entry.event_campaign_id === subject.campaign_id)) return true;
  const subjectTitle = normalize(subject.goal_title || "");
  const planTitle = normalize(planSubject.goal_title || "");
  if (!subjectTitle || !planTitle || subjectTitle !== planTitle) return false;
  return categoryCompatible(subject.category || null,
    planSubject.category || entry.plan.category || null);
}

const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "my", "this", "that", "for", "to", "of", "and", "or",
  "with", "help", "please", "how", "should", "i", "we", "our", "your",
  "goal", "campaign", "plan", "fundraiser", "fundraising", "raise",
  "raising", "money", "support", "about", "what", "when", "first", "next",
  "update", "updates", "post", "posts", "share", "write", "make", "get",
]);
const titleTokens = text => new Set(normalize(text || "").split(" ")
  .filter(token => token.length >= 3 && !TITLE_STOPWORDS.has(token)));

// Resolve which campaign/goal a discussion is about, strongest evidence
// first: (a) an explicit campaign/goal identifier supplied with the
// request; (b) the goal the member names in their own message, or the one
// on-file goal their message demonstrably mentions; (c) none — the caller
// must then label any fallback knowledge with the goal it belongs to.
export function resolveDiscussionSubject({ campaignId = null, goalTitle = null, category = null, question = "", plans = [] } = {}) {
  if (UUID.test(campaignId || ""))
    return { resolved: true, via: "explicit_campaign",
      subject: { campaign_id: campaignId, goal_title: goalTitle || null, category: category || null } };
  const named = (typeof goalTitle === "string" && goalTitle.trim())
    ? goalTitle.replace(/\s+/g, " ").trim().slice(0, 120) : extractGoalTitle(question);
  if (named)
    return { resolved: true, via: goalTitle ? "explicit_goal" : "question_title",
      subject: { campaign_id: null, goal_title: named, category: category || detectGoalCategory(question) } };
  const questionTokens = titleTokens(question);
  if (questionTokens.size && Array.isArray(plans) && plans.length) {
    const scored = plans
      .map(entry => ({ entry, score: [...titleTokens(entry.plan.subject?.goal_title || "")]
        .filter(token => questionTokens.has(token)).length }))
      .filter(candidate => candidate.score > 0);
    if (scored.length) {
      const best = Math.max(...scored.map(candidate => candidate.score));
      const winners = scored.filter(candidate => candidate.score === best);
      if (winners.length === 1) {
        const planSubject = winners[0].entry.plan.subject || {};
        return { resolved: true, via: "question_mentions_goal",
          subject: { campaign_id: planSubject.campaign_id || winners[0].entry.event_campaign_id || null,
            goal_title: planSubject.goal_title || null,
            category: planSubject.category || winners[0].entry.plan.category || null } };
      }
    }
  }
  return { resolved: false, via: null, subject: null };
}

// Scoped cross-referencing: pick the on-file knowledge FOR the resolved
// subject. Outcomes:
// - "match": a plan attributable to the subject (newest such plan).
// - "none_for_subject": a subject is resolved but no plan belongs to it —
//   the caller must say so and must not substitute another goal's plan.
// - "unresolved": no subject could be resolved; the newest plan may be
//   offered ONLY with its ownership label attached (see the summary's
//   for_goal), never as the current topic's knowledge.
// - "none_on_file": no prepared plan exists at all.
export function selectGoalKnowledgeForDiscussion(events, subject) {
  const plans = parseGoalKnowledgePlans(events);
  if (!plans.length) return { state: "none_on_file", plan: null, entry: null, subject: subject || null };
  if (!subject) return { state: "unresolved", plan: plans[0].plan, entry: plans[0], subject: null };
  const match = plans.find(entry => goalKnowledgeMatchesSubject(entry, subject));
  return match
    ? { state: "match", plan: match.plan, entry: match, subject }
    : { state: "none_for_subject", plan: null, entry: null, subject };
}

// Compact form of an on-file plan for a model message: enough for any agent
// to apply the learned knowledge in discussion — the paths to favour, the
// category practices, the questions the research set out to answer — without
// re-sending the member's private wording.
export function goalKnowledgeApplicationSummary(plan, { eventCampaignId = null } = {}) {
  if (!plan || plan.kind !== "goal_knowledge_refinement") return null;
  return {
    label: GOAL_KNOWLEDGE_LABEL,
    category: typeof plan.category === "string" ? plan.category : "general",
    // Attribution: the goal this knowledge was refined for. Consumers must
    // name it when they draw on the knowledge and must never present it as
    // belonging to a different goal under discussion. A plan prepared
    // before subject blocks existed is attributed through the campaign its
    // team event was recorded under, when there is one.
    for_goal: {
      title: typeof plan.subject?.goal_title === "string" ? plan.subject.goal_title : null,
      category: typeof plan.subject?.category === "string" ? plan.subject.category
        : (typeof plan.category === "string" ? plan.category : "general"),
      campaign_id: UUID.test(plan.subject?.campaign_id || "") ? plan.subject.campaign_id
        : (UUID.test(eventCampaignId || "") ? eventCampaignId : null),
    },
    knowledge_areas: Array.isArray(plan.knowledge_areas) ? plan.knowledge_areas.slice(0, 10) : [],
    brief_sections: Array.isArray(plan.brief_sections) ? plan.brief_sections.slice(0, 9) : [],
    research_questions: Array.isArray(plan.research_questions)
      ? plan.research_questions.slice(0, 8).map(q => String(q).slice(0, 300)) : [],
    brief_expires_after_days: plan.brief_expires_after_days || 90,
  };
}

// Cross-campaign learning candidate: category-level patterns only. Contact
// details, links, phone numbers and exact amounts are stripped
// automatically before anything can be proposed as a reusable playbook
// entry. Names cannot be detected reliably by pattern, which is exactly
// why a super-admin must review and approve every candidate before it can
// influence another member's campaign.
export function anonymizeForCategoryPlaybook({ category = "general", findings = "" } = {}) {
  const cleaned = redactTeamCredentials(String(findings || ""))
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[contact removed]")
    .replace(/https?:\/\/\S+/g, "[link removed]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone removed]")
    .replace(/\$\s?\d[\d,]*(?:\.\d{2})?/g, "[amount removed]")
    .trim().slice(0, 2000);
  return {
    kind: "category_playbook_candidate",
    category,
    findings: cleaned,
    personal_data_removed: true,
    requires_super_admin_approval: true,
    training_promoted: false,
  };
}
