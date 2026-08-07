#!/usr/bin/env node
/**
 * Interplanetary Fund — Agent Research Script
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Uses the Browserbase browse CLI to perform internet research for agents.
 * Each agent has a specialized research profile.
 *
 * Usage:
 *   node scripts/agent-research.mjs <agent-role> [topic-index]
 *
 * Examples:
 *   node scripts/agent-research.mjs strategy       # Research top topic for Strategy Agent
 *   node scripts/agent-research.mjs story 2       # Research 3rd topic for Story Agent
 *   node scripts/agent-research.mjs all            # Research all agents
 *
 * Requires:
 *   - browse CLI installed (npm install -g browse)
 *   - BROWSERBASE_API_KEY set in environment
 */

import { execSync } from "child_process";

const AGENT_PROFILES = {
  strategy: {
    name: "Strategy Agent",
    topics: [
      "crowdfunding best practices 2026 site:medium.com OR site:nonprofitpro.com",
      "campaign launch strategy fundraising",
      "fundraising milestones and goal setting",
      "nonprofit protocol compliance frameworks",
    ],
    searchKeywords: ["fundraising strategy", "campaign planning", "donor acquisition"],
  },
  story: {
    name: "Story Agent",
    topics: [
      "donation psychology emotional triggers research",
      "fundraising story writing best practices",
      "conversion optimized campaign copy examples",
      "empathy in charitable giving studies",
    ],
    searchKeywords: ["donation copywriting", "fundraising story", "emotional appeal"],
  },
  growth: {
    name: "Growth Agent",
    topics: [
      "donor acquisition channels 2026 fundraising",
      "social media fundraising growth tactics",
      "seed funding strategies for campaigns",
      "viral crowdfunding campaign analysis",
    ],
    searchKeywords: ["donor growth", "fundraising channels", "viral campaigns"],
  },
  communications: {
    name: "Communications Agent",
    topics: [
      "facebook group outreach best practices fundraising",
      "social media posting frequency optimization",
      "multi-platform content distribution strategy",
      "hashtag strategies for nonprofit fundraising",
    ],
    searchKeywords: ["social media outreach", "facebook groups", "content distribution"],
  },
  lyra: {
    name: "Lyra — Chief of Staff",
    topics: [
      "AI agent orchestration multi-agent systems",
      "nonprofit platform architecture best practices",
      "revenue optimization for fundraising platforms",
    ],
    searchKeywords: ["agent coordination", "platform architecture", "revenue optimization"],
  },
};

function runBrowse(args) {
  try {
    return execSync(`browse ${args}`, { encoding: "utf-8", timeout: 60000 });
  } catch (e) {
    return e.stdout || e.message;
  }
}

function researchAgent(role, topicIndex = 0) {
  const profile = AGENT_PROFILES[role];
  if (!profile) {
    console.error(`Unknown agent role: ${role}`);
    console.error(`Available roles: ${Object.keys(AGENT_PROFILES).join(", ")}`);
    process.exit(1);
  }

  const topic = profile.topics[topicIndex] || profile.topics[0];
  console.log(`\n🔍 Researching for ${profile.name}`);
  console.log(`   Topic: ${topic}\n`);

  // Use Browserbase search
  const searchResult = runBrowse(`cloud search "${topic}" --format json 2>/dev/null`);
  console.log("Search Results:");
  console.log(searchResult);

  // Fetch top result for detailed content
  try {
    const results = JSON.parse(searchResult);
    if (results && results.length > 0) {
      const topUrl = results[0].url;
      console.log(`\n📄 Fetching top result: ${topUrl}\n`);
      const pageContent = runBrowse(`cloud fetch ${topUrl} 2>/dev/null`);
      console.log(pageContent.substring(0, 2000));
    }
  } catch {
    // If JSON parsing fails, the raw output is already shown
  }

  console.log(`\n✅ Research complete for ${profile.name}`);
}

// Main
const role = process.argv[2] || "all";
const topicIndex = parseInt(process.argv[3] || "0");

if (role === "all") {
  console.log("🚀 Running research sprint for all agents...\n");
  for (const r of Object.keys(AGENT_PROFILES)) {
    researchAgent(r, topicIndex);
    console.log("\n" + "=".repeat(60) + "\n");
  }
  console.log("✅ All agent research complete.");
} else {
  researchAgent(role, topicIndex);
}
