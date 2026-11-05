import ifundApi from "../../../../worker/index.js";

/**
 * Route same-origin API requests through the shared IFund Worker router.
 * Studio AI is opt-in and requires BOTH the explicit environment flag and
 * the actual Workers AI binding. A missing binding must always fail closed.
 */
export async function onRequest(context) {
  const studioAiEnabled =
    context.env?.IFUND_STUDIO_AI_ENABLED === "enabled" &&
    typeof context.env?.AI?.run === "function";
  const env = {
    ...context.env,
    IFUND_STUDIO_ENABLED: "enabled",
    IFUND_STUDIO_AI_ENABLED: studioAiEnabled ? "enabled" : "disabled",
  };
  return ifundApi.fetch(context.request, env, context);
}
