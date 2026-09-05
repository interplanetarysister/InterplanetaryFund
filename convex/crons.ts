/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every scheduled write-producing automation task is dispatched by the same
// fenced coordinator. Fixed-time daily/weekly jobs are gated inside their UTC
// hour; interval jobs keep their 2/4/6/8/12-hour cadence there as well.
// Keep minuteUTC at 0 because the legacy daily/weekly production schedules were
// explicitly pinned to :00 and cadence equivalence is a release requirement.
crons.hourly(
  "serialized-automation-lane",
  { minuteUTC: 0 },
  internal.automationCoordinator.runSerializedAutomation,
  {},
);

export default crons;
