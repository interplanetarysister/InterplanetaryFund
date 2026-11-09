/** Saved owner text remains discoverable even if writing access is disabled or expires. */
export async function loadWritingWorkspaceAccess(api) {
  const [queue, subscription] = await Promise.allSettled([
    api("queued-requests"),
    api("subscription"),
  ]);
  const queueRows =
    queue.status === "fulfilled" && Array.isArray(queue.value?.queued_requests)
      ? queue.value.queued_requests
      : null;
  return {
    queued_requests: queueRows,
    queue_error:
      queueRows === null
        ? "Saved writing requests could not be loaded. Reload to try again."
        : "",
    access: subscription.status === "fulfilled" ? subscription.value : null,
    access_error:
      subscription.status === "rejected"
        ? "Writing access could not be verified."
        : "",
  };
}
