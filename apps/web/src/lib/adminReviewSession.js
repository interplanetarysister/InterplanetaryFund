// A review scope is permanently invalidated on session change or view refresh.
// Returning to the original account must not revive pending privileged replies.
export function createAdminReviewSession(onInvalidate = () => {}) {
  let active = true;
  let ownerId = null;
  let observedId;
  function invalidate() {
    if (!active) return;
    active = false;
    onInvalidate();
  }
  return {
    get active() { return active; },
    get ownerId() { return ownerId; },
    invalidate,
    observe(userId) {
      observedId = userId || null;
      if (ownerId && observedId !== ownerId) invalidate();
    },
    bind(userId) {
      if (!active || !userId || (observedId !== undefined && observedId !== userId)) {
        invalidate();
        throw Error("The administrative session changed. Reload to verify access.");
      }
      ownerId = userId;
    },
    async verify(client) {
      if (!active || !ownerId) throw Error("The administrative session changed. Reload to verify access.");
      const { data, error } = await client.auth.getUser();
      if (!active || error || data?.user?.id !== ownerId) {
        invalidate();
        throw Error("The administrative session changed. Reload to verify access.");
      }
      return ownerId;
    },
  };
}

export async function runAdminReview(scope, client, operation) {
  await scope.verify(client);
  const result = await operation();
  await scope.verify(client);
  return result;
}
