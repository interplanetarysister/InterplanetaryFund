import ifundApi from "../../../../worker/index.js";

/** Route all same-origin /api/* requests through the shared IFund Worker router. */
export async function onRequest(context) {
  const env = {
    ...context.env,
    IFUND_STUDIO_ENABLED: "enabled",
    // Never enable AI by default: both an explicit preview flag and a real
    // Workers AI binding are required. Production remains disabled unless
    // separately and explicitly configured after cost verification.
    IFUND_STUDIO_AI_ENABLED:
      context.env.IFUND_STUDIO_AI_ENABLED === "enabled" &&
      typeof context.env.AI?.run === "function"
        ? "enabled"
        : "disabled",
  };
  return ifundApi.fetch(context.request, env, context);
}
