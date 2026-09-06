/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// All contested write-producing automation is dispatched from the durable,
// fenced hourly coordinator. Keep minuteUTC at 0 to preserve the exact legacy
// UTC daily/weekly timing gates implemented inside the coordinator.
crons.hourly(
  "serialized-automation-lane",
  { minuteUTC: 0 },
  internal.automationCoordinator.runSerializedAutomation,
  {},
);

// Canonical outreach dispatch is intentionally preserved as its own isolated
// hourly lane because it has independent admin/emergency-stop/quiet-hours/
// subscription/platform authorization gates and does not participate in the
// contested shared automation write set covered by the P0 fence.
crons.interval(
  "canonical-outreach-dispatch",
  { minutes: 60 },
  internal.outreachControl.runDispatchCycle,
  {},
);

export default crons;
