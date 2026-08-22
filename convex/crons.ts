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
// Auto-Repair — Every 6 hours
crons.interval("auto-repair", { minutes: 360 }, internal.autonomous.autoRepair, {});
// Agent Research Sprint — Every 12 hours (now via Browserbase)
crons.interval("agent-research-sprint", { minutes: 720 }, internal.research.runAgentResearch, {});

// === SERIALIZED AUTOMATION LANE ===
// Site health + agent automation + Browserbase research are deliberately
// executed through ONE cron lane. This replaces the previous independent
// crons that could mutate overlapping agent/distributedPosts state at once.
// The coordinator preserves each agent's historical cadence internally.
// Hourly is the cadence of the lane; individual work is run only when due.
crons.hourly("serialized-automation-lane", internal.automationCoordinator.runSerializedAutomation, {});

// === IMAGE GENERATION (Credit-Free via Pollinations.ai) ===
// Auto-generate cover images for new campaigns — Every 12 hours
crons.interval("auto-cover-images", { minutes: 720 }, internal.imageGen.generateCampaignCoverUrls, {});

// === FUND CONSOLIDATION (Credit-Free) ===
// Auto-consolidate funds for campaigns with AI automation enabled — Every 6 hours
crons.interval("auto-fund-consolidation", { minutes: 360 }, internal.fundConsolidation.runAutoConsolidation, {});

export default crons;
