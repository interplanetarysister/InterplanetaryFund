import { base44 } from "@/api/base44Client";

export async function logPlatformEvent({ action, category, affected_resource, outcome = "success", details }) {
  const { data } = await base44.functions.invoke("logPlatformEvent", { action, category, affected_resource, outcome, details });
  return data?.event;
}
