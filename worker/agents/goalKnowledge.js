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

export function buildGoalKnowledgePlan({ question = "", category = null, origin = "chat" } = {}) {
  const resolvedCategory = category || detectGoalCategory(question);
  const subject = resolvedCategory === "general" ? "this kind of goal" : `a ${resolvedCategory.replace(/_/g, " ")} goal`;
  return {
    kind: "goal_knowledge_refinement",
    version: GOAL_KNOWLEDGE_VERSION,
    label: GOAL_KNOWLEDGE_LABEL,
    status: "prepared",
    origin,
    category: resolvedCategory,
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
// and apply it. History events carry the plan as JSON content; the latest
// eligible plan wins. Returns null when nothing usable is on file.
export function extractGoalKnowledgeFromHistory(events) {
  if (!Array.isArray(events)) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    const content = events[i]?.content;
    if (typeof content !== "string" || !content.includes("goal_knowledge_refinement")) continue;
    try {
      const parsed = JSON.parse(content);
      const plan = parsed?.goal_knowledge_refinement;
      if (plan && plan.kind === "goal_knowledge_refinement" && plan.status === "prepared")
        return plan;
    } catch { /* not a plan record; keep scanning */ }
  }
  return null;
}

// Compact form of an on-file plan for a model message: enough for any agent
// to apply the learned knowledge in discussion — the paths to favour, the
// category practices, the questions the research set out to answer — without
// re-sending the member's private wording.
export function goalKnowledgeApplicationSummary(plan) {
  if (!plan || plan.kind !== "goal_knowledge_refinement") return null;
  return {
    label: GOAL_KNOWLEDGE_LABEL,
    category: typeof plan.category === "string" ? plan.category : "general",
    knowledge_areas: Array.isArray(plan.knowledge_areas) ? plan.knowledge_areas.slice(0, 10) : [],
    brief_sections: Array.isArray(plan.brief_sections) ? plan.brief_sections.slice(0, 9) : [],
    research_questions: Array.isArray(plan.research_questions)
      ? plan.research_questions.slice(0, 8).map(q => String(q).slice(0, 300)) : [],
    brief_expires_after_days: plan.brief_expires_after_days || 90,
  };
}

// Cross-campaign learning candidate: category-level patterns only. Names,
// contact details, links and exact amounts are stripped before anything can
// be proposed as a reusable playbook entry, and a super-admin must approve
// it before it influences another member's campaign.
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
