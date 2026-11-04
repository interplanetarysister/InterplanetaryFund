import test from "node:test";
import assert from "node:assert/strict";
import {
  strategyRequest,
  strategyMessages,
  strategyOutput,
  strategyResponseFormat,
} from "../worker/agents/strategy.js";
const uid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const rec = {
  campaign_id: uid,
  title: "Clarify the supply list",
  description: "Explain what supplies are needed.",
  reasoning: "Specific needs help people understand the purpose.",
  evidence: "The organizer is raising funds for school supplies.",
  confidence: "medium",
  expected_impact: "An estimate: clearer communication.",
  estimated_effort: "A short writing session.",
  agent: "story",
};
const plan = {
  summary: "Focus on making the campaign need clear.",
  today_priorities: ["Check the supplied facts.", "Clarify the need."],
  week_priorities: ["Review the story.", "Gather evidence."],
  long_term: ["Review outcomes.", "Reassess priorities."],
  risks: ["Donation activity is unavailable."],
  predictions: [
    {
      forecast: "Clearer copy may help understanding.",
      confidence: "low",
      evidence: "No outcome evidence is available.",
      recommended_action: "Review the copy.",
    },
  ],
  recommendations: [
    rec,
    { ...rec, title: "Review the existing cover" },
    { ...rec, title: "Plan a future review" },
  ],
};
test("strategy request rejects authority and publishing options", () => {
  assert.throws(() =>
    strategyRequest({
      request_id: uid,
      objective: "A decision",
      publish: true,
    }),
  );
  assert.equal(
    strategyRequest({ request_id: uid, objective: " Where should I focus? " })
      .objective,
    "Where should I focus?",
  );
});
test("brief requires owned campaign context and keeps unknown metrics unknown", () => {
  assert.throws(() =>
    strategyMessages({ objective: "Help" }, { campaigns: [] }),
  );
  const messages = strategyMessages(
    { objective: "Where should I focus?" },
    { campaigns: [{ id: uid, title: "School supplies" }] },
  );
  const data = JSON.parse(messages[1].content);
  assert.deepEqual(data.verified_donation_activity, { available: false });
  assert.equal("total_raised" in data, false);
  assert.match(messages[0].content, /not an executed handoff/);
});
test("structured plan cannot add foreign campaigns or confer another role", () => {
  assert.equal(
    strategyOutput({ response: plan }, [uid]).recommendations.length,
    3,
  );
  assert.throws(() =>
    strategyOutput(
      {
        response: {
          ...plan,
          recommendations: [{ ...rec, campaign_id: other }, rec, rec],
        },
      },
      [uid],
    ),
  );
  assert.throws(() =>
    strategyOutput(
      {
        response: {
          ...plan,
          recommendations: [{ ...rec, agent: "admin_builder_agent" }, rec, rec],
        },
      },
      [uid],
    ),
  );
});
test("plan validation rejects malformed results and removes model-invented action flags", () => {
  assert.throws(() => strategyOutput("not json", [uid]));
  const clean = strategyOutput(
    {
      response: {
        ...plan,
        published: true,
        recommendations: plan.recommendations.map((r) => ({
          ...r,
          publish: true,
          approved: true,
        })),
      },
    },
    [uid],
  );
  assert.equal("published" in clean, false);
  assert.equal("approved" in clean.recommendations[0], false);
  assert.equal(
    strategyResponseFormat().json_schema.additionalProperties,
    false,
  );
});
test("oversized stored campaign context never reaches inference", () => {
  assert.throws(
    () =>
      strategyMessages(
        { objective: "Help" },
        { campaigns: [{ id: uid, title: "x".repeat(30000) }] },
      ),
    /too much/,
  );
});
