/*
 * Interplanetary Fund — Agent automation authorization boundary.
 * This compatibility entry point uses the same super-admin session as the
 * primary agent automation controls. PIN arguments are not accepted.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdminSession } from "./adminUsers";
import { checkRateLimit } from "./security";

export const toggleAgentAutomation = mutation({
  args: { sessionToken: v.string(), agentName: v.string(), enabled: v.boolean() },
  handler: async (ctx, { sessionToken, agentName, enabled }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    checkRateLimit(`agent-automation-toggle:${principal._id}`, 5, 60_000);
    const agent = await ctx.db.query("agents").filter((q) => q.eq(q.field("name"), agentName)).first();
    if (!agent) return { success: false, error: "Agent not found" };
    await ctx.db.patch(agent._id, { automationEnabled: enabled });
    await ctx.db.insert("agentActivityLog", {
      agentName, action: enabled ? "automation_enabled" : "automation_disabled", category: "protocol",
      description: `${agentName} automation ${enabled ? "enabled" : "disabled"} by ${principal.name}`,
      creditCost: 0, timestamp: new Date().toISOString(),
    });
    return { success: true, agentName, automationEnabled: enabled };
  },
});
