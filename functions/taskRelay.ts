import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: "Invalid JSON body" }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  const { action, sprintId, context, nextSteps, completedThisSession, status } = body;
  const relayId = "ifund-sprint-relay";
  
  if (action === "save") {
    try {
      const existing = await base44.entities.TaskRelay.list();
      const record = existing.find((r: any) => r.sprintId === relayId);
      
      const data: any = {
        sprintId: relayId,
        context: context || "No context saved",
        nextSteps: nextSteps || [],
        completedThisSession: completedThisSession || [],
        status: status || "paused",
        lastUpdated: new Date().toISOString(),
        activeSprint: sprintId || "sprint-" + Date.now(),
        totalSprints: (record?.totalSprints || 0) + 1
      };
      
      if (record) {
        await base44.entities.TaskRelay.update(record.id, data);
      } else {
        await base44.entities.TaskRelay.create(data);
      }
      
      return new Response(JSON.stringify({ success: true, message: "Context relay saved", sprintId: relayId }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  if (action === "load") {
    try {
      const existing = await base44.entities.TaskRelay.list();
      const record = existing.find((r: any) => r.sprintId === relayId);
      
      if (!record) {
        return new Response(JSON.stringify({ success: false, message: "No relay state found" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        context: record.context,
        nextSteps: record.nextSteps,
        completedThisSession: record.completedThisSession,
        status: record.status,
        lastUpdated: record.lastUpdated,
        totalSprints: record.totalSprints
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  if (action === "autonomous_check") {
    let convexHealth = "unknown";
    try {
      const response = await fetch("https://rosy-butterfly-2.convex.cloud/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "protocol/enforceProtocol", args: {} })
      });
      convexHealth = response.ok ? "healthy" : "degraded";
    } catch {
      convexHealth = "check_failed";
    }
    
    let ghActionsStatus = "unknown";
    try {
      const response = await fetch("https://api.github.com/repos/interplanetarysister/InterplanetaryFund/actions/runs?per_page=1", {
        headers: { "Accept": "application/vnd.github.v3+json" }
      });
      if (response.ok) {
        const data: any = await response.json();
        ghActionsStatus = data.workflow_runs?.[0]?.status || "unknown";
      }
    } catch {
      ghActionsStatus = "check_failed";
    }
    
    try {
      const existing = await base44.entities.TaskRelay.list();
      const record = existing.find((r: any) => r.sprintId === relayId);
      
      if (record) {
        await base44.entities.TaskRelay.update(record.id, {
          context: `Autonomous check: Convex=${convexHealth}, GitHub Actions=${ghActionsStatus}`,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch {}
    
    return new Response(JSON.stringify({
      success: true,
      convexHealth,
      ghActionsStatus,
      timestamp: new Date().toISOString()
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ success: false, message: "Unknown action" }), {
    headers: { "Content-Type": "application/json" }
  });
});
