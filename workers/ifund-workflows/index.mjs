// IFund workflow execution service — scheduled and entity-triggered workflows.
// Invokes backend functions via Supabase Edge Functions (primary) with Base44
// fallback (transitional). Part of the Interplanetary Fund migration from
// Base44 to independent Cloudflare + Supabase hosting.

const manifest = {
  schema_version: 1,
  execution: "enabled",
  source: "Base44 definitions migrated to Cloudflare Workers",
  workflows: [
    { name: "AI Outreach Agent", trigger_type: "scheduled", cron_expression: "0 */6 * * *", timezone: "UTC", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "runOutreachAgent" }] },
    { name: "Admin Action Conversation Router", trigger_type: "scheduled", cron_expression: "*/15 * * * *", timezone: "America/Los_Angeles", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "processAdminActionInbox" }] },
    { name: "Campaign Protocol", trigger_type: "entity", cron_expression: null, timezone: null, events: ["create", "update"], entity_name: "Campaign", steps: [{ call: "invoke_backend_function", function_name: "enforceCampaignProtocol" }] },
    { name: "Campaign Sync on Create", trigger_type: "entity", cron_expression: null, timezone: null, events: ["create"], entity_name: "Campaign", steps: [{ call: "invoke_backend_function", function_name: "syncConnections" }] },
    { name: "Campaign Sync on Update", trigger_type: "entity", cron_expression: null, timezone: null, events: ["create"], entity_name: "CampaignUpdate", steps: [{ call: "invoke_backend_function", function_name: "syncConnections" }] },
    { name: "Connection Sync Engine", trigger_type: "scheduled", cron_expression: "0 * * * *", timezone: "America/Los_Angeles", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "syncConnections" }] },
    { name: "External Feed Mirroring", trigger_type: "scheduled", cron_expression: "0 * * * *", timezone: "UTC", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "mirrorExternalPosts" }] },
    { name: "Feature Discovery on Completion", trigger_type: "entity", cron_expression: null, timezone: null, events: ["update"], entity_name: "Campaign", steps: [{ call: "invoke_backend_function", function_name: "discoverFeatures" }] },
    { name: "Grant Application Review", trigger_type: "entity", cron_expression: null, timezone: null, events: ["create"], entity_name: "GrantApplication", steps: [{ call: "invoke_backend_function", function_name: "analyzeGrantApplication" }] },
    { name: "IFund Official Social Editor", trigger_type: "scheduled", cron_expression: "0 */4 * * *", timezone: "America/Los_Angeles", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "runOfficialSocialPromotion" }] },
    { name: "IFund Reporter Daily Diary", trigger_type: "scheduled", cron_expression: "30 17 * * *", timezone: "America/Los_Angeles", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "runReporterDiary" }] },
    { name: "Integration Health Check", trigger_type: "scheduled", cron_expression: "30 */6 * * *", timezone: "America/Los_Angeles", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "validateIntegrationHealth" }] },
    { name: "PayPal Holding Settlement Reconciliation", trigger_type: "scheduled", cron_expression: "0 * * * *", timezone: "America/Los_Angeles", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "discoverPayPalHoldingSettlements" }] },
    { name: "Platform Account Steward", trigger_type: "scheduled", cron_expression: "30 15 * * *", timezone: "America/Los_Angeles", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "maintainPlatformOwnedAccounts" }] },
    { name: "Social Media Autopilot", trigger_type: "scheduled", cron_expression: "0 14 * * *", timezone: "UTC", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "runSocialAutopilot" }] },
    { name: "Volunteer Welcome Follow-up", trigger_type: "entity", cron_expression: null, timezone: null, events: ["create"], entity_name: "VolunteerSignup", steps: [{ call: "invoke_backend_function", function_name: "welcomeVolunteer" }, { call: null, function_name: null }, { call: "invoke_backend_function", function_name: "volunteerFollowUp" }] },
    { name: "Weekly Writing Psychology & Social Trends Training", trigger_type: "scheduled", cron_expression: "0 16 * * *", timezone: "UTC", events: [], entity_name: null, steps: [{ call: "invoke_backend_function", function_name: "refreshWritingResearch" }] },
  ],
};

// Financial/sensitive functions — logged with elevated warning level
const SENSITIVE_FUNCTIONS = new Set([
  "discoverPayPalHoldingSettlements",
  "analyzeGrantApplication",
  "maintainPlatformOwnedAccounts",
]);

const scheduledWorkflows = manifest.workflows.filter((w) => w.trigger_type === "scheduled");
const entityWorkflows = manifest.workflows.filter((w) => w.trigger_type === "entity");

const respond = (v, status = 200) =>
  Response.json(v, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

// ── Cron field matching ──────────────────────────────────────────────────────────
function cronFieldMatch(field, value) {
  if (field === "*") return true;
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    return step > 0 && value % step === 0;
  }
  if (field.includes(",")) {
    return field.split(",").some((f) => cronFieldMatch(f.trim(), value));
  }
  return parseInt(field, 10) === value;
}

// Get current time components in the given IANA timezone (or UTC)
function getTimeInZone(timezone, now = new Date()) {
  if (!timezone || timezone === "UTC") {
    return {
      minute: now.getUTCMinutes(),
      hour: now.getUTCHours(),
      dayOfMonth: now.getUTCDate(),
      month: now.getUTCMonth() + 1,
      dayOfWeek: now.getUTCDay(),
    };
  }
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short",
    });
    const parts = {};
    for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      minute: parseInt(parts.minute, 10),
      hour: parseInt(parts.hour, 10) % 24,
      dayOfMonth: parseInt(parts.day, 10),
      month: parseInt(parts.month, 10),
      dayOfWeek: dowMap[parts.weekday] ?? 0,
    };
  } catch {
    // Fallback to UTC if timezone is invalid
    return {
      minute: now.getUTCMinutes(),
      hour: now.getUTCHours(),
      dayOfMonth: now.getUTCDate(),
      month: now.getUTCMonth() + 1,
      dayOfWeek: now.getUTCDay(),
    };
  }
}

function shouldRunNow(cronExpr, timezone, now = new Date()) {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hour, dom, month, dow] = parts;
  const t = getTimeInZone(timezone, now);
  return (
    cronFieldMatch(min, t.minute) &&
    cronFieldMatch(hour, t.hour) &&
    (dom === "*" || cronFieldMatch(dom, t.dayOfMonth)) &&
    (month === "*" || cronFieldMatch(month, t.month)) &&
    (dow === "*" || cronFieldMatch(dow, t.dayOfWeek))
  );
}

// ── Backend function invocation ──────────────────────────────────────────
async function invokeBackendFunction(functionName, workflow, env, payload) {
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const supabaseKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  const base44Origin = (env.IFUND_BASE44_ORIGIN || "").replace(/\/+$/, "");
  const base44Key = env.IFUND_WORKFLOW_API_KEY;

  const isSensitive = SENSITIVE_FUNCTIONS.has(functionName);
  const callPayload = JSON.stringify({
    workflow: workflow.name,
    trigger_type: workflow.trigger_type,
    entity_name: workflow.entity_name,
    events: workflow.events,
    source: "cloudflare-ifund-workflows",
    ...payload,
  });

  // Primary: Supabase Edge Function
  if (supabaseUrl && supabaseKey) {
    try {
      const url = `${supabaseUrl}/functions/v1/${functionName}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: callPayload,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      let body = null;
      try { body = await resp.json(); } catch { try { body = await resp.text(); } catch {} }
      if (resp.ok) {
        return { function: functionName, backend: "supabase", status: resp.status, ok: true, result: body };
      }
      // If Supabase returns 404 (function not deployed), fall through to Base44
      if (resp.status !== 404) {
        return { function: functionName, backend: "supabase", status: resp.status, ok: false, result: body };
      }
    } catch (err) {
      // Network error — fall through to Base44 if available
      console.log(JSON.stringify({ service: "ifund-workflows", function: functionName, supabase_error: err.message }));
    }
  }

  // Transitional fallback: Base44
  if (base44Origin && base44Key) {
    try {
      const url = `${base44Origin}/functions/${functionName}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${base44Key}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: callPayload,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      let body = null;
      try { body = await resp.json(); } catch { try { body = await resp.text(); } catch {} }
      return { function: functionName, backend: "base44", status: resp.status, ok: resp.ok, result: body };
    } catch (err) {
      return { function: functionName, backend: "base44", ok: false, error: err.message };
    }
  }

  return {
    function: functionName,
    ok: false,
    error: "No backend configured — set SUPABASE_SERVICE_KEY or IFUND_WORKFLOW_API_KEY",
  };
}

async function executeWorkflow(workflow, env, payload = {}) {
  const results = [];
  for (const step of workflow.steps) {
    if (!step.call || !step.function_name) continue; // skip null/wait steps

    if (SENSITIVE_FUNCTIONS.has(step.function_name)) {
      console.log(JSON.stringify({
        service: "ifund-workflows",
        workflow: workflow.name,
        function: step.function_name,
        warning: "sensitive_financial_function",
      }));
    }

    const result = await invokeBackendFunction(step.function_name, workflow, env, payload);
    results.push(result);
    if (!result.ok) break; // stop on first failure
  }
  return { executed: true, workflow: workflow.name, results };
}

async function checkAgentOpsBinding(env) {
  try{return await env.IFUND_AGENT_OPS_SCHEDULER.ping()==="ifund-agent-ops-scheduler-v1";}
  catch{return false;}
}

// ── Worker entry point ──────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // Health check
    if (req.method === "GET" && url.pathname === "/health") {
      const enabled = env.IFUND_WORKFLOWS_ENABLED === "enabled";
      return respond({
        service: "ifund-workflows",
        alive: true,
        ready: enabled,
        execution: enabled ? "enabled" : "disabled",
        workflow_count: manifest.workflows.length,
        scheduled_count: scheduledWorkflows.length,
        entity_count: entityWorkflows.length,
        supabase_configured: !!env.SUPABASE_URL && !!(env.SUPABASE_SERVICE_KEY || env.SUPABASE_PUBLISHABLE_KEY),
        base44_configured: !!env.IFUND_BASE44_ORIGIN && !!env.IFUND_WORKFLOW_API_KEY,
        agent_ops_binding_ready: await checkAgentOpsBinding(env),
      });
    }

    // Workflow catalog
    if (req.method === "GET" && url.pathname === "/v1/workflows/catalog") {
      const enabled = env.IFUND_WORKFLOWS_ENABLED === "enabled";
      return respond({
        execution: enabled ? "enabled" : "disabled",
        workflows: manifest.workflows.map((w) => ({
          name: w.name,
          trigger_type: w.trigger_type,
          cron_expression: w.cron_expression,
          timezone: w.timezone,
          events: w.events,
          entity_name: w.entity_name,
          steps: w.steps.map((s) => ({ call: s.call, function_name: s.function_name })),
          sensitive: w.steps.some((s) => s.function_name && SENSITIVE_FUNCTIONS.has(s.function_name)),
        })),
      });
    }

    // Entity trigger webhook (called by Supabase database webhooks)
    if (req.method === "POST" && url.pathname === "/v1/workflows/trigger") {
      if (env.IFUND_WORKFLOWS_ENABLED !== "enabled") {
        return respond({ error: "workflow_execution_not_ready" }, 503);
      }
      // Verify webhook secret if configured
      if (env.IFUND_WORKFLOW_WEBHOOK_SECRET) {
        const auth = req.headers.get("authorization") || "";
        if (auth !== `Bearer ${env.IFUND_WORKFLOW_WEBHOOK_SECRET}`) {
          return respond({ error: "unauthorized" }, 401);
        }
      }
      let body;
      try { body = await req.json(); } catch { return respond({ error: "invalid_json" }, 400); }

      const entityName = body.entity_name || body.table || body.record?.type;
      const eventType = body.event_type || body.type || (body.record ? "create" : "update");

      const matching = entityWorkflows.filter(
        (w) => w.entity_name === entityName && w.events.includes(eventType),
      );

      if (matching.length === 0) {
        return respond({ triggered: 0, entity: entityName, event: eventType });
      }

      const results = [];
      for (const workflow of matching) {
        const result = await executeWorkflow(workflow, env, { entity_record: body.record || body });
        results.push(result);
      }
      return respond({ triggered: matching.length, entity: entityName, event: eventType, results });
    }

    // Manual trigger endpoint (for testing/debugging)
    if (req.method === "POST" && url.pathname.startsWith("/v1/workflows/run/")) {
      if (env.IFUND_WORKFLOWS_ENABLED !== "enabled") {
        return respond({ error: "workflow_execution_not_ready" }, 503);
      }
      const workflowName = decodeURIComponent(url.pathname.replace("/v1/workflows/run/", ""));
      const workflow = manifest.workflows.find((w) => w.name === workflowName);
      if (!workflow) return respond({ error: "workflow_not_found", available: manifest.workflows.map((w) => w.name) }, 404);
      const result = await executeWorkflow(workflow, env);
      return respond(result);
    }

    // List all workflows with their next-run estimate
    if (req.method === "GET" && url.pathname === "/v1/workflows/status") {
      const enabled = env.IFUND_WORKFLOWS_ENABLED === "enabled";
      return respond({
        execution: enabled ? "enabled" : "disabled",
        scheduled: scheduledWorkflows.map((w) => ({
          name: w.name,
          cron: w.cron_expression,
          timezone: w.timezone,
          function: w.steps[0]?.function_name,
          sensitive: w.steps.some((s) => s.function_name && SENSITIVE_FUNCTIONS.has(s.function_name)),
        })),
        entity: entityWorkflows.map((w) => ({
          name: w.name,
          entity: w.entity_name,
          events: w.events,
          steps: w.steps.filter((s) => s.function_name).map((s) => s.function_name),
        })),
      });
    }

    return respond({ error: "not_found" }, 404);
  },

  async scheduled(event, env, ctx) {
    if (env.IFUND_WORKFLOWS_ENABLED !== "enabled") {
      console.log(JSON.stringify({ service: "ifund-workflows", status: "disabled", cron: event.cron }));
      return;
    }

    // Dispatch only from the scheduled handler, never a public HTTP route.
    // Agent Ops retains its 30-minute cadence and its own scoped secret,
    // database lease, and eight-run daily quota.
    const scheduledAt=new Date(event.scheduledTime);
    if(Number.isFinite(scheduledAt.getTime()) && scheduledAt.getUTCMinutes()%30===0){
      ctx.waitUntil((async()=>{
        try{
          if(!env.IFUND_AGENT_OPS_SCHEDULER)throw Error("missing private binding");
          const receipt=await env.IFUND_AGENT_OPS_SCHEDULER.tick();
          console.log(JSON.stringify({service:"ifund-workflows",job:"agent-ops",state:receipt?.state||"unavailable"}));
        }catch{console.error(JSON.stringify({service:"ifund-workflows",job:"agent-ops",state:"failed"}));}
      })());
    }
    // Match actual scheduled time, rather than a delayed invocation clock.
    const toRun = scheduledWorkflows.filter((w) => shouldRunNow(w.cron_expression, w.timezone, scheduledAt));

    if (toRun.length === 0) return;

    console.log(JSON.stringify({
      service: "ifund-workflows",
      cron: event.cron,
      matched: toRun.map((w) => w.name),
    }));

    for (const workflow of toRun) {
      ctx.waitUntil(
        executeWorkflow(workflow, env)
          .then((result) =>
            console.log(JSON.stringify({ service: "ifund-workflows", workflow: workflow.name, result })),
          )
          .catch((err) =>
            console.log(JSON.stringify({ service: "ifund-workflows", workflow: workflow.name, error: err.message })),
          ),
      );
    }
  },
};
