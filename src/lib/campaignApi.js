// Optional same-origin Cloudflare Worker transport for campaign editor writes.
// Off by default until the independent Worker and destination RLS are verified.
export const workerCampaignApiEnabled =
  import.meta.env?.VITE_IFUND_CAMPAIGN_API === "enabled";

export async function saveCampaignThroughWorker(
  db,
  campaign,
  id,
  fetcher = fetch,
) {
  if (!db) throw new Error("Account services are unavailable.");
  const { data, error: authError } = await db.auth.getSession();
  if (authError || !data?.session?.access_token) {
    throw new Error("Please sign in again before saving.");
  }
  const endpoint = id
    ? "/api/campaigns/" + encodeURIComponent(id)
    : "/api/campaigns";
  const result = await fetcher(endpoint, {
    method: id ? "PATCH" : "POST",
    credentials: "same-origin",
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(campaign),
  });
  // Provider errors are sanitized by the Worker, not logged in the browser.
  const response = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw new Error(response.error || "Campaign could not be saved.");
  }
  if (!response.id || typeof response.id !== "string") {
    throw new Error("Campaign save could not be verified.");
  }
  return response.id;
}
