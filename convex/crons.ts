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
// The shared write-producing automation work below is serialized in one lane.
// Proactive Group Discovery remains independent because it writes facebookGroups.
crons.interval("proactive-group-discovery", { minutes: 240 }, internal.facebook.discoverGroupsProactively, {});

// === SERIALIZED SHARED AUTOMATION ===
// One hourly cron owns the formerly independent shared writers. The coordinator
// preserves each workload's cadence inside the lane and uses a durable lease to
// prevent duplicate/manual overlap at the shared write boundary.
crons.interval("serialized-automation-lane", { minutes: 60 }, internal.automationCoordinator.runSerializedAutomation, {});

// === IMAGE GENERATION (Credit-Free via Pollinations.ai) ===
// Auto-generate cover images for new campaigns — Every 12 hours
crons.interval("auto-cover-images", { minutes: 720 }, internal.imageGen.generateCampaignCoverUrls, {});

// === FUND CONSOLIDATION (Credit-Free) ===
// Auto-consolidate funds for campaigns with AI automation enabled — Every 6 hours
crons.interval("auto-fund-consolidation", { minutes: 360 }, internal.fundConsolidation.runAutoConsolidation, {});

export default crons;
