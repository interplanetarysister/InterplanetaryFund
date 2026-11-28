import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGoalKnowledgePlan, extractGoalTitle, parseGoalKnowledgePlans,
  resolveDiscussionSubject, selectGoalKnowledgeForDiscussion,
  goalKnowledgeApplicationSummary,
} from "../worker/agents/goalKnowledge.js";
import { routeTeamQuestion, validateTeamQuestion } from "../worker/agents/teamQuestion.js";
import { storyInput, storyMessages } from "../worker/agents/story.js";

// Owner report (2026-11-27): agents mixed up context between a member's
// DIFFERENT campaigns/goals — knowledge refined for goal B was applied
// while discussing goal A. These tests pin the isolation contract: plans
// carry a subject, application is scoped to the resolved subject, a
// resolved subject with no plan of its own gets an explicit "none on
// file" marker (never a substitution), and an unresolved subject only
// ever receives the latest plan labelled with the goal it belongs to.

const UID = "11111111-1111-4111-8111-111111111111";
const CAMP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAMP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAMP_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const eventId = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const planA = buildGoalKnowledgePlan({ question: "Deep research my goal: surgery bills" });
const planB = buildGoalKnowledgePlan({ question: "Deep research my goal: record an album" });
const planEvent = (plan, n, recorded_at, campaign_id = null) => ({
  id: eventId(n), event_key: eventId(100 + n), agent_id: "nexus", speaker: "agent",
  source_kind: "agent_response", campaign_id, recorded_at,
  content: JSON.stringify({ goal_knowledge_refinement: plan }),
});
// Newest first, exactly as ifund_team_recent returns them: B was refined
// most recently, A earlier.
const twoGoalHistory = [
  planEvent(planB, 2, "2026-11-26T03:00:00Z"),
  { id: eventId(3), event_key: eventId(103), agent_id: "nexus", speaker: "user",
    source_kind: "user_statement", campaign_id: null, recorded_at: "2026-11-26T02:00:00Z",
    content: "thanks, that helps" },
  planEvent(planA, 1, "2026-11-26T01:00:00Z"),
];

test("every prepared plan records the subject it belongs to", () => {
  assert.equal(planA.subject.goal_title, "surgery bills");
  assert.equal(planA.subject.category, "medical");
  assert.equal(planA.subject.fingerprint, "surgery bills|medical");
  assert.equal(planA.subject.campaign_id, null);
  const scoped = buildGoalKnowledgePlan({
    question: "Please deep research this", campaignId: CAMP_A, goalTitle: "Surgery Bills for Dad",
  });
  assert.equal(scoped.subject.campaign_id, CAMP_A);
  assert.equal(scoped.subject.goal_title, "Surgery Bills for Dad");
  // No naming, no title: the plan is unattributed rather than misattributed.
  const anonymous = buildGoalKnowledgePlan({ question: "Research my plan for something new" });
  assert.equal(anonymous.subject.goal_title, null);
  assert.equal(anonymous.subject.fingerprint, null);
  assert.equal(extractGoalTitle("How do I write a campaign story?"), null);
  assert.equal(extractGoalTitle("Deep research my goal: surgery bills"), "surgery bills");
});

test("selection applies only the plan belonging to the resolved subject", () => {
  const forA = selectGoalKnowledgeForDiscussion(twoGoalHistory,
    { campaign_id: null, goal_title: "surgery bills", category: "medical" });
  assert.equal(forA.state, "match");
  assert.equal(forA.plan.subject.goal_title, "surgery bills");
  const forB = selectGoalKnowledgeForDiscussion(twoGoalHistory,
    { campaign_id: null, goal_title: "record an album", category: "creative" });
  assert.equal(forB.state, "match");
  assert.equal(forB.plan.subject.goal_title, "record an album");
  // A resolved subject with no plan of its own: explicit none, and the
  // other goals' plans are NOT substituted.
  const forC = selectGoalKnowledgeForDiscussion(twoGoalHistory,
    { campaign_id: null, goal_title: "new roof repair", category: "emergency" });
  assert.equal(forC.state, "none_for_subject");
  assert.equal(forC.plan, null);
});

test("campaign identity matches through the plan subject or its team event", () => {
  const scopedA = buildGoalKnowledgePlan({ question: "Deep research my goal: surgery bills", campaignId: CAMP_A });
  const history = [
    planEvent(planB, 2, "2026-11-26T03:00:00Z", CAMP_B),
    planEvent(scopedA, 1, "2026-11-26T01:00:00Z", CAMP_A),
  ];
  const match = selectGoalKnowledgeForDiscussion(history,
    { campaign_id: CAMP_A, goal_title: null, category: null });
  assert.equal(match.state, "match");
  assert.equal(match.plan.subject.campaign_id, CAMP_A);
  const other = selectGoalKnowledgeForDiscussion(history,
    { campaign_id: CAMP_C, goal_title: null, category: null });
  assert.equal(other.state, "none_for_subject");
});

test("legacy plans without a subject block never satisfy a resolved subject", () => {
  const legacy = { ...planA };
  delete legacy.subject;
  const history = [planEvent(legacy, 1, "2026-11-26T01:00:00Z")];
  const resolved = selectGoalKnowledgeForDiscussion(history,
    { campaign_id: null, goal_title: "surgery bills", category: "medical" });
  assert.equal(resolved.state, "none_for_subject");
  // ...but they remain available, labelled, when no subject is resolved.
  const fallback = selectGoalKnowledgeForDiscussion(history, null);
  assert.equal(fallback.state, "unresolved");
  assert.equal(goalKnowledgeApplicationSummary(fallback.plan).for_goal.category, "medical");
  assert.equal(goalKnowledgeApplicationSummary(fallback.plan).for_goal.title, null);
});

test("unresolved discussions receive only the latest plan, labelled as its goal's", () => {
  const selection = selectGoalKnowledgeForDiscussion(twoGoalHistory, null);
  assert.equal(selection.state, "unresolved");
  assert.equal(selection.plan.subject.goal_title, "record an album");
  const summary = goalKnowledgeApplicationSummary(selection.plan);
  assert.equal(summary.for_goal.title, "record an album");
  assert.equal(summary.for_goal.category, "creative");
});

test("subject resolution: explicit id, named goal, mentioned goal, else none", () => {
  const plans = parseGoalKnowledgePlans(twoGoalHistory);
  assert.equal(resolveDiscussionSubject({ campaignId: CAMP_A, plans }).via, "explicit_campaign");
  assert.equal(resolveDiscussionSubject({ goalTitle: "new roof repair", plans }).via, "explicit_goal");
  assert.equal(resolveDiscussionSubject({ question: "Deep research my goal: surgery bills", plans }).via, "question_title");
  const mentioned = resolveDiscussionSubject({ question: "How should I promote my surgery bills campaign this week?", plans });
  assert.equal(mentioned.resolved, true);
  assert.equal(mentioned.subject.goal_title, "surgery bills");
  const album = resolveDiscussionSubject({ question: "What is the best way to promote the album launch?", plans });
  assert.equal(album.resolved, true);
  assert.equal(album.subject.goal_title, "record an album");
  assert.equal(resolveDiscussionSubject({ question: "What should I work on next?", plans }).resolved, false);
});

test("team question validation accepts subject context and rejects forged shapes", () => {
  const ok = validateTeamQuestion({ request_id: UID, question: "Help with my story", agent: "story", campaign_id: CAMP_A, goal_title: "Surgery bills" });
  assert.equal(ok.campaignId, CAMP_A);
  assert.equal(ok.goalTitle, "Surgery bills");
  assert.throws(() => validateTeamQuestion({ request_id: UID, question: "Help", agent: "story", campaign_id: "not-a-uuid" }));
  assert.throws(() => validateTeamQuestion({ request_id: UID, question: "Help", agent: "story", owner_id: UID }));
});

// --- Route level: the real team-question flow over a two-goal history. ---
function contextHarness(history) {
  const inferences = [];
  const fetcher = async (url) => {
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: UID, email_confirmed_at: "2026-11-01T00:00:00Z", is_anonymous: false });
    if (url.endsWith("/rpc/ifund_current_account_is_active")) return Response.json(true);
    if (url.includes("/ifund_ai_permission_preferences?"))
      return Response.json([{ owner_id: UID, allow_ai_campaign_drafts: true, allow_ai_outreach_drafts: true, allow_future_internal_ai_assistance: true }]);
    if (url.endsWith("/rpc/ifund_reserve_agent_question")) return Response.json({ allowed: true, state: "reserved", remaining: 10 });
    if (url.endsWith("/rpc/ifund_complete_agent_question")) return Response.json(true);
    if (url.endsWith("/rpc/ifund_release_agent_question")) return Response.json(true);
    if (url.endsWith("/rpc/ifund_team_recent")) return Response.json(history);
    if (url.endsWith("/rpc/ifund_team_record_user") || url.endsWith("/rpc/ifund_team_record_agent")) return Response.json(UID);
    throw Error("Unexpected " + url);
  };
  const env = {
    IFUND_TEAM_QUESTIONS_ENABLED: "enabled", IFUND_TEAM_CONTEXT_ENABLED: "enabled",
    IFUND_WORKFORCE_EXECUTOR_KEY: "a".repeat(64),
    SUPABASE_URL: "https://ssibsfmtodgximseeqsv.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-test",
    AI: { run: async (model, params) => {
      inferences.push(params.messages);
      return { response: "Here is focused help for your goal." };
    } },
  };
  return { fetcher, env, inferences };
}
const askTeam = (h, body) => routeTeamQuestion(new Request("https://ifund.test/api/agents/team/question", {
  method: "POST", headers: { authorization: "Bearer test.jwt.token", "content-type": "application/json" },
  body: JSON.stringify(body),
}), h.env, h.fetcher);
const knowledgeMessage = (h) => {
  const messages = h.inferences.at(-1) || [];
  const found = messages.map(m => m.content).filter(c => c.includes("goal_knowledge_on_file"));
  assert.equal(found.length, 1, "exactly one knowledge application message");
  return JSON.parse(found[0]);
};

test("discussing goal A applies goal A's knowledge, never the newer goal B plan", async () => {
  const h = contextHarness(twoGoalHistory);
  const response = await askTeam(h, { request_id: UID, agent: "story",
    question: "How should I promote my surgery bills campaign this week?" });
  assert.equal(response.status, 200);
  const applied = knowledgeMessage(h);
  assert.equal(applied.goal_knowledge_on_file.for_goal.title, "surgery bills");
  assert.equal(applied.goal_knowledge_on_file.for_goal.category, "medical");
  assert.doesNotMatch(JSON.stringify(applied), /record an album/);
  assert.match(applied.instruction, /discussing now/);
});

test("discussing goal B applies goal B's knowledge, never goal A's", async () => {
  const h = contextHarness(twoGoalHistory);
  const response = await askTeam(h, { request_id: UID, agent: "story",
    question: "What is the best way to promote the album launch?" });
  assert.equal(response.status, 200);
  const applied = knowledgeMessage(h);
  assert.equal(applied.goal_knowledge_on_file.for_goal.title, "record an album");
  assert.doesNotMatch(JSON.stringify(applied), /surgery bills/);
});

test("a resolved goal with no plan of its own gets an explicit none-on-file marker", async () => {
  const h = contextHarness(twoGoalHistory);
  const response = await askTeam(h, { request_id: UID, agent: "story",
    question: "How do I get started?", goal_title: "new roof repair" });
  assert.equal(response.status, 200);
  const applied = knowledgeMessage(h);
  assert.equal(applied.goal_knowledge_on_file, null);
  assert.equal(applied.no_refined_knowledge_for_current_goal.goal, '"new roof repair"');
  assert.match(applied.instruction, /do not apply it to this discussion/);
});

test("an unscoped discussion receives the latest plan only with attribution required", async () => {
  const h = contextHarness(twoGoalHistory);
  const response = await askTeam(h, { request_id: UID, agent: "story",
    question: "What should I work on next?" });
  assert.equal(response.status, 200);
  const applied = knowledgeMessage(h);
  assert.equal(applied.goal_knowledge_on_file.for_goal.title, "record an album");
  assert.match(applied.instruction, /Attribution required/);
});

// --- Story level: campaign drafts are scoped to the campaign's own goal. ---
const storyHistory = [
  planEvent(planB, 2, "2026-11-26T03:00:00Z", CAMP_B),
  planEvent(buildGoalKnowledgePlan({ question: "Deep research my goal: surgery bills", campaignId: CAMP_A }),
    1, "2026-11-26T01:00:00Z", CAMP_A),
];
const storyFor = (campaign) => {
  const input = storyInput({
    details: "Please draft the story for this campaign with the facts provided here.",
    request_id: UID, campaign_id: campaign?.id ?? null,
  });
  const messages = storyMessages(input, {
    shared_agent_history: storyHistory,
    ...(campaign ? { campaign: { title: campaign.title, summary: "s", story: "x", category: campaign.category, goal_amount: 5000 } } : {}),
  });
  return JSON.parse(messages[1].content);
};

test("story drafts apply only the plan refined for that campaign", () => {
  const a = storyFor({ id: CAMP_A, title: "Surgery Bills for Dad", category: "medical" });
  assert.equal(a.goal_knowledge_scope, "match");
  assert.equal(a.goal_knowledge_on_file.for_goal.campaign_id, CAMP_A);
  const b = storyFor({ id: CAMP_B, title: "Record an Album", category: "creative" });
  assert.equal(b.goal_knowledge_scope, "match");
  assert.equal(b.goal_knowledge_on_file.for_goal.campaign_id, CAMP_B);
  const c = storyFor({ id: CAMP_C, title: "New Roof Repair", category: "emergency" });
  assert.equal(c.goal_knowledge_scope, "none_for_subject");
  assert.equal(c.goal_knowledge_on_file, null);
  const unscoped = storyFor(null);
  assert.equal(unscoped.goal_knowledge_scope, "unresolved");
  assert.equal(unscoped.goal_knowledge_on_file.for_goal.title, "record an album");
});
