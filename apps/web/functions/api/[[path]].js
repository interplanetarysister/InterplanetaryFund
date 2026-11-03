import ifundApi from "../../../../worker/index.js";

/** Route all same-origin /api/* requests through the shared IFund Worker router. */
export async function onRequest(context) {
  const env = {
    ...context.env,
    IFUND_STUDIO_ENABLED: "enabled",
    IFUND_STUDIO_AI_ENABLED: "disabled",
  };
  return ifundApi.fetch(context.request, env, context);
}
