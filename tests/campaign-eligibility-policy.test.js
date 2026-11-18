import test from "node:test";
import assert from "node:assert/strict";
import { IFUND_CAMPAIGN_ELIGIBILITY_POLICY } from "../worker/agents/campaignPolicy.js";
import { strategyMessages } from "../worker/agents/strategy.js";
import { growthMessages } from "../worker/agents/growth.js";
import { communicationsMessages } from "../worker/agents/communications.js";
import { storyMessages } from "../worker/agents/story.js";
import { serviceSkill } from "../worker/services/skills/index.js";

const id = "11111111-1111-4111-8111-111111111111";
const campaign = {
  id, title: "Community project", summary: "A verified project",
  story: "Organizer-supplied story", category: "community",
  status: "draft", goal_amount: 1000, has_story: true, has_cover_image: false,
};
const containsPolicy = (messages) => {
  assert.ok(messages[0].content.includes("UNIVERSAL IFUND CAMPAIGN ELIGIBILITY AND GROWTH POLICY"));
  assert.ok(messages[0].content.includes("Those outside audience members do not need IFund accounts."));
  assert.ok(messages[0].content.includes("new-user acquisition"));
  assert.ok(messages[0].content.includes("neutral invitations"));
  assert.ok(messages[0].content.includes("must NOT receive campaign-support services"));
  assert.ok(messages[0].content.includes("IFund-native campaign creation exception"));
  assert.ok(messages[0].content.includes("EXTERNAL CREATOR PERMISSION OFFER"));
  assert.ok(messages[0].content.includes("Ask which option they prefer"));
  assert.ok(messages[0].content.includes("informal"));
  assert.ok(messages[0].content.includes("revocation path"));
};

test("the shared policy explicitly separates eligible campaigns from unrestricted external audiences", () => {
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /This restricts which campaigns you service, NOT who you may reach/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /potential donors, supporters, partners, communities/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /new-user acquisition/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /neutral invitations/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /must NOT receive campaign-support services/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /without requiring them to create an IFund login/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /separate, explicit, recorded authorization/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /informal/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /payout destination checks/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /full operational control/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /every IFund AI feature\/agent/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /unrestricted permission/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /unrelated personal data/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /payout-destination changes/);
});

test("active Strategy and Growth prompts receive the universal policy", () => {
  const input = { request_id: "22222222-2222-4222-8222-222222222222", objective: "Prioritize growth" };
  const context = { campaigns: [campaign] };
  containsPolicy(strategyMessages(input, context));
  containsPolicy(growthMessages(input, context));
});

test("active Communications prompt receives the universal policy for owner-scoped campaign work", () => {
  const input = { campaign_id: id, details: "Prepare a truthful campaign update", comm_type: "update" };
  const context = { campaign, recent_messages: [], research: { available: false } };
  containsPolicy(communicationsMessages(input, context));
});

test("active Story prompt receives the policy and preserves IFund-native campaign creation", () => {
  const input = {
    request_id: "33333333-3333-4333-8333-333333333333",
    details: "Create a new community campaign in the IFund campaign creator.",
    campaign_id: null,
    section: null,
  };
  containsPolicy(storyMessages(input, { research: { available: false }, preferences: [] }));
});

test("every registered specialist receives the same policy at runtime", () => {
  for (const role of [
    "admin_builder_agent", "chief_of_staff", "communications_agent", "connection_discovery_agent",
    "finance_agent", "growth_agent", "managed_connection_agent",
    "outreach_agent", "story_agent", "strategy_agent",
  ]) {
    const instructions = serviceSkill(role).instructions;
    assert.ok(instructions.includes("UNIVERSAL IFUND CAMPAIGN ELIGIBILITY AND GROWTH POLICY"));
    assert.ok(instructions.includes("Those outside audience members do not need IFund accounts."));
    assert.ok(instructions.includes("EXTERNAL CREATOR PERMISSION OFFER"));
    assert.ok(instructions.includes("without requiring them to create an IFund login"));
  }
});


test("all IFund specialists may discuss internal platform context without a campaign ID", () => {
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /INTERNAL IFUND NETWORK COMMUNICATIONS/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /do not prohibit ordinary IFund-context conversations/);
  assert.match(IFUND_CAMPAIGN_ELIGIBILITY_POLICY, /not permission to access private member data/);
  for (const role of [
    "admin_builder_agent", "chief_of_staff", "communications_agent",
    "connection_discovery_agent", "finance_agent", "growth_agent",
    "managed_connection_agent", "outreach_agent", "story_agent",
    "strategy_agent",
  ]) {
    assert.match(serviceSkill(role).instructions, /INTERNAL IFUND NETWORK COMMUNICATIONS/);
  }
});
