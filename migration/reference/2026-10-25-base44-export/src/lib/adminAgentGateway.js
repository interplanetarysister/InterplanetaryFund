import { runtimeContract } from "@/lib/runtimeContract";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Base44 is the authoritative authenticated data plane. A separate Cloudflare
// gateway is optional, not a prerequisite for the native Base44 admin chat.
// Both execution paths recheck super-admin authorization on the server.
const NATIVE_ADMIN_SESSION = "base44-authenticated-admin";
export const adminGatewayMode = runtimeContract.adminAgentApiUrl ? "external" : "base44";

async function invokeAdminFunction(name, body) {
  let response;
  try {
    response = await base44.functions.invoke(name, body);
  } catch (error) {
    // The SDK can throw with a JSON response in error.response.data.
    const detail = error?.response?.data?.error || error?.data?.error || error?.message;
    throw new Error(typeof detail === "string" && detail.length < 240 ? detail : "Admin backend is unavailable. Try again.");
  }
  const data = response?.data;
  if (!data || typeof data !== "object") throw new Error("Admin backend returned an invalid response.");
  if (data.error) throw new Error(data.error);
  return data;
}

function gatewayHeaders() {
  const token = String(appParams.token || "").trim();
  if (!token) throw new Error("Sign in again before opening the admin development gateway.");
  return {
    "content-type": "application/json",
    "authorization": `Bearer ${token}`,
  };
}

async function postGateway(path, body) {
  if (!runtimeContract.adminAgentApiUrl) {
    throw new Error("Admin development-agent gateway is not configured on this host.");
  }
  const response = await fetch(`${runtimeContract.adminAgentApiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: gatewayHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Admin agent request failed.");
  return payload;
}

export async function createAdminAgentSession({ adminKey, agent = "chief_of_staff" }) {
  // The builder role always uses the authoritative Base44 server check,
  // even when an optional external admin gateway is configured.
  if (adminGatewayMode === "external" && agent !== "admin_builder_agent") {
    return postGateway("/v1/admin/agents/session", { adminKey, agent });
  }
  // No client-side key, role claim, or session ID grants authorization.
  // The backend uses the current Base44 session to verify the admin role
  // and approved super-admin owner before issuing any privileged request.
  const verified = await invokeAdminFunction("verifyAdminGateway", {});
  if (verified.role !== "admin" || verified.super_admin !== true || !verified.id) {
    throw new Error("The signed-in account does not have verified super-admin access.");
  }
  return { sessionId: NATIVE_ADMIN_SESSION, expiresIn: null, mode: "base44" };
}

export async function sendAdminAgentMessage({ sessionId, content, agent }) {
  const native = sessionId === NATIVE_ADMIN_SESSION;
  // Unknown session IDs are never silently switched to another route.
  if (!native && adminGatewayMode === "base44") throw new Error("Admin access expired. Verify your account again.");
  const started = native
    ? await invokeAdminFunction("executeAdminAgentRequest", { agent, content })
    : await postGateway("/v1/admin/agents/message", { sessionId, content, agent });
  if (started.execution_status !== "processing" || !started.activityId) return started;

  let latest = started;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(1250);
    latest = native
      ? await invokeAdminFunction("executeAdminAgentRequest", { mode: "status", activityId: started.activityId })
      : await postGateway("/v1/admin/agents/status", { sessionId, activityId: started.activityId });
    if (latest.execution_status !== "processing") return latest;
  }

  return {
    ...latest,
    response: latest.response || "The agent is still working. Its request remains recorded in Agent Activity.",
  };
}
