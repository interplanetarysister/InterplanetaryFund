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
crons.daily("daily-protocol-autofix", { hourUTC: 13, minuteUTC: 0 }, internal.protocolAutoFix.runFullAutoFix, {});
crons.weekly("weekly-training-session", { dayOfWeek: "saturday", hourUTC: 9, minuteUTC: 0 }, internal.protocol.weeklyTraining, {});

// === POST GENERATION & OUTREACH ===
// This independent lane targets facebookGroups, not distributedPosts.
crons.interval("proactive-group-discovery", { minutes: 240 }, internal.facebook.discoverGroupsProactively, {});

// === SERIALIZED SHARED-WRITER LANE ===
// Shared automation writers execute sequentially inside one cron-owned lane.
// Historical cadences are enforced by automationCoordinator; do not re-add
// independent shared-writer crons here or introduce a time-expiring lease.
crons.hourly("serialized-automation-lane", internal.automationCoordinator.runSerializedAutomation, {});

// === IMAGE GENERATION (Credit-Free via Pollinations.ai) ===
crons.interval("auto-cover-images", { minutes: 720 }, internal.imageGen.generateCampaignCoverUrls, {});

// === FUND CONSOLIDATION (Credit-Free) ===
crons.interval("auto-fund-consolidation", { minutes: 360 }, internal.fundConsolidation.runAutoConsolidation, {});

export default crons;
