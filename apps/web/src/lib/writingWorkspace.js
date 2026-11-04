/** Saved owner text remains discoverable even if writing access is disabled or expires. */
export async function loadWritingWorkspaceAccess(api) {
  const [queue, subscription] = await Promise.allSettled([
    api("queued-requests"),
    api("subscription"),
  ]);
  return {
    queued_requests:
      queue.status === "fulfilled" ? queue.value.queued_requests || [] : [],
    access: subscription.status === "fulfilled" ? subscription.value : null,
  };
}
