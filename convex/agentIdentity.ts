/*
 * Interplanetary Fund — Canonical Agent Identity Registry
 *
 * Stable identity across the Base44 conversational layer and Convex
 * operational agents without deleting or renaming existing records.
 */

import { query } from "./_generated/server";

export const CANONICAL_AGENTS = [
  { canonicalId: "solene", displayName: "Solene", role: "chief_of_staff", base44Names: ["Chief of Staff", "chief_of_staff"], operationalNames: ["Solene"] },
  { canonicalId: "atlas", displayName: "Atlas", role: "facebook_interactions", base44Names: ["Outreach Agent", "outreach_agent"], operationalNames: ["Atlas", "Facebook Interactions"] },
  { canonicalId: "post_production", displayName: "Post Production Agent", role: "campaign_post_production", base44Names: ["Strategy Agent", "strategy_agent"], operationalNames: ["Post Production Agent", "Strategy Agent"] },
  { canonicalId: "donor_relations", displayName: "Donor Relations Agent", role: "donation_public_relations", base44Names: ["Story Agent", "story_agent"], operationalNames: ["Donor Relations Agent", "Story Agent"] },
  { canonicalId: "scout", displayName: "Scout Agent", role: "crowdfunding_scout", base44Names: ["Growth Agent", "growth_agent"], operationalNames: ["Scout Agent", "Growth Agent"] },
  { canonicalId: "platform_coordinator", displayName: "Platform Coordinator Agent", role: "platform_coordination", base44Names: ["Communications Agent", "communications_agent"], operationalNames: ["Platform Coordinator Agent", "Communications Agent"] },
  { canonicalId: "finance", displayName: "Finance Agent", role: "finance", base44Names: ["Finance Agent", "finance_agent"], operationalNames: ["Finance Agent"] },
];

export const getCanonicalAgents = query({
  args: {},
  handler: async () => CANONICAL_AGENTS,
});
