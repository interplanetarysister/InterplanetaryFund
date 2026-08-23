/*
 * Interplanetary Fund — Agent automation authorization boundary.
 *
 * Transitional secure entry point for agent automation controls. The legacy
 * toggle in agentAutomation.ts remains a separate migration target until the
 * UI is moved to this permission-checked mutation and the legacy public entry
 * point is removed.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission, checkRateLimit } from "./security";

export const toggleAgentAutomation = mutation({
  args: {
    requestorPin: v.string(),
    agentName: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { requestorPin, agentName, enabled }) => {
    checkRateLimit(`agent-automation-toggle:${requestorPin}`, 5, 60_000);
    await requirePermission(ctx, requestorPin, "settings");

    const agent = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("name"), agentName))
      .first();

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    await ctx.db.patch(agent._id, { automationEnabled: enabled });

    await ctx.db.insert("agentActivityLog", {
      agentName,
      action: enabled ? "automation_enabled" : "automation_disabled",
      category: "protocol",
      description: `${agentName} automation ${enabled ? "enabled" : "disabled"} by authorized admin`,
      creditCost: 0,
      timestamp: new Date().toISOString(),
    });

    return { success: true, agentName, automationEnabled: enabled };
  },
});
