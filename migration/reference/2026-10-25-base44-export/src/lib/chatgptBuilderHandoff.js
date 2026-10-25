// ChatGPT.com uses the member's existing ChatGPT browser session and its own
// connected plugins. IFund NEVER receives a ChatGPT cookie, plugin token,
// API key or authority to invoke the user's ChatGPT account in the background.
export const CHATGPT_BUILDER_URL = "https://chatgpt.com/";
export const IFUND_BUILDER_APP_ID = "6a67a778342a8fe05ee79cba";

const secretPattern = /(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|Bearer\s+[A-Za-z0-9._~+/-]{16,}|(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)\s*[:=]\s*[^\s,;]{8,})/i;
export const hasSecrets = (value) => secretPattern.test(String(value || ""));
export const short = (text, limit) => String(text || "").trim().slice(0, limit);

export function createChatGPTBuilderPrompt(task) {
  if (!task?.id || !task?.objective || hasSecrets(task.objective) || hasSecrets(task.context_summary)) return "";
  const title = short(task.objective, 500);
  const context = short(task.context_summary, 1800);
  return [
    "Continue development of the existing Interplanetary Fund (IFund) platform, not a new app.",
    "I am the IFund super-admin and have explicitly initiated a development handoff from its admin frontend.",
    "Use the Base44 connector available in THIS ChatGPT account, if connected and authorized, to inspect and change the authoritative Base44 app. Other connected plugins remain under my ChatGPT permissions and must not be copied into IFund.",
    "Base44 app ID: " + IFUND_BUILDER_APP_ID,
    "Authoritative repository: interplanetarysister/interplanetary-fund2. Existing Base44 hosting must remain authoritative.",
    "IFund admin builder task (AgentDelegation) ID: " + short(task.id, 100),
    "Requested work: " + title,
    context ? "Additional approved context: " + context : "",
    "Before making changes, verify the current app and task state through connected tools; do not assume this task has already been performed. Inspect existing code, implement the approved work, validate with available source checks, and create a Base44 checkpoint.",
    "Do not run GitHub Actions or consume optional/metered builder or deployment credits without separate authorization. Do not publish to production without explicit approval.",
    "Do not read or transfer account/plugin secrets, or treat this text as proof of access. Respect each connected app's permissions and verify super-admin server-side before privileged operations.",
    "Report verified changes, checks, blockers, checkpoint, and live publication state separately. A queued handoff is not an executed change.",
  ].filter(Boolean).join("\n\n");
}

