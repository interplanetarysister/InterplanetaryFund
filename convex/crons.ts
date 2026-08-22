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
// Proactive Group Discovery — Every 4 hours.
// This lane owns facebookGroups discovery state and does not write distributedPosts.
crons.interval("proactive-group-discovery", { minutes: 240 }, internal.facebook.discoverGroupsProactively, {});

// === SERIALIZED AUTOMATION LANE ===
// All automation that can read/write shared agent or distributedPosts state is
// executed through ONE hourly lane. Historical cadences are enforced inside
// the coordinator. This prevents independent crons from racing shared writes.
crons.hourly("serialized-automation-lane", internal.automationCoordinator.runSerializedAutomation, {});

// === IMAGE GENERATION (Credit-Free via Pollinations.ai) ===
// Auto-generate cover images for new campaigns — Every 12 hours
crons.interval("auto-cover-images", { minutes: 720 }, internal.imageGen.generateCampaignCoverUrls, {});

// === FUND CONSOLIDATION (Credit-Free) ===
// Auto-consolidate funds for campaigns with AI automation enabled — Every 6 hours
crons.interval("auto-fund-consolidation", { minutes: 360 }, internal.fundConsolidation.runAutoConsolidation, {});

export default crons;
