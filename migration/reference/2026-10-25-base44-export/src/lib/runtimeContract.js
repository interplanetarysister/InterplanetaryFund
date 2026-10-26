const trim = (value) => String(value || "").trim().replace(/\/$/, "");

export const runtimeContract = Object.freeze({
  productId: "interplanetary-fund",
  dataPlane: "base44",
  appId: String(import.meta.env.VITE_BASE44_APP_ID || "").trim(),
  appBaseUrl: trim(import.meta.env.VITE_BASE44_APP_BASE_URL),
  adminAgentApiUrl: trim(import.meta.env.VITE_ADMIN_AGENT_API_URL),
});

export function assertRuntimeContract() {
  if (!runtimeContract.appId) throw new Error("Interplanetary Fund runtime is missing VITE_BASE44_APP_ID.");
  if (!runtimeContract.appBaseUrl) throw new Error("Interplanetary Fund runtime is missing VITE_BASE44_APP_BASE_URL.");
  return runtimeContract;
}
