/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// All times in UTC. Pacific is UTC-7 (PDT) or UTC-8 (PST).
// ALL cron jobs run credit-free on Convex infrastructure.

const crons = cronJobs();

// === PROTOCOL ENFORCEMENT (Credit-Free Auto-Fix) ===
// Daily Protocol Auto-Fix — 6am Pacific (13:00 UTC)
crons.daily("daily-protocol-autofix", { hourUTC: 13, minuteUTC: 0 }, internal.protocolAutoFix.runFullAutoFix, {});
// Weekly Training — Saturday 2am Pacific (09:00 UTC Saturday)
crons.weekly("weekly-training-session", { dayOfWeek: "saturday", hourUTC: 9, minuteUTC: 0 }, internal.protocol.weeklyTraining, {});

// === POST GENERATION & OUTREACH ===
// Daily Auto-Post Generation — 8am Pacific (15:00 UTC)
crons.daily("daily-post-generation", { hourUTC: 15, minuteUTC: 0 }, internal.postContent.autoGeneratePosts, {});
// Proactive Group Discovery — Every 4 hours
crons.interval("proactive-group-discovery", { minutes: 240 }, internal.facebook.discoverGroupsProactively, {});
// Outreach Strategy Improvement — Every 6 hours
crons.interval("outreach-strategy-improvement", { minutes: 360 }, internal.facebook.improveOutreachStrategy, {});

// === AUTONOMOUS OPERATIONS (Credit-Free) ===
// Site Health Monitor — Every hour
crons.interval("site-health-monitor", { minutes: 60 }, internal.autonomous.checkSiteHealth, {});
// Auto-Repair — Every 6 hours
crons.interval("auto-repair", { minutes: 360 }, internal.autonomous.autoRepair, {});
// Agent Research Sprint — Every 12 hours
crons.interval("agent-research-sprint", { minutes: 720 }, internal.research.runAgentResearch, {});

// === PER-AGENT AUTOMATION (Credit-Free) ===
// Each agent has its own cron schedule and can be individually toggled on/off
// via the automationEnabled field in the agents table.

// Atlas — Facebook Interactions Agent — Every 4 hours
crons.interval("atlas-facebook-automation", { minutes: 240 }, internal.agentAutomation.runAtlasAutomation, {});

// Post Production Agent — Campaign Content — Every 6 hours
crons.interval("post-production-automation", { minutes: 360 }, internal.agentAutomation.runPostProductionAutomation, {});

// Donor Relations Agent — Donation PR — Every 6 hours
crons.interval("donor-relations-automation", { minutes: 360 }, internal.agentAutomation.runDonorRelationsAutomation, {});

// Scout Agent — Crowdfunding Scout — Every 8 hours
crons.interval("scout-automation", { minutes: 480 }, internal.agentAutomation.runScoutAutomation, {});

// Platform Coordinator — Cross-Agent Coordination — Every 4 hours
crons.interval("coordinator-automation", { minutes: 240 }, internal.agentAutomation.runCoordinatorAutomation, {});

// Master Automation Check — Every 2 hours (ensures all agents are active)
crons.interval("master-agent-check", { minutes: 120 }, internal.agentAutomation.runAllAgentAutomation, {});

export default crons;
