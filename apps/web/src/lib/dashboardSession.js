import { memberIdentity } from "./guestAccess.js";

/** Observe one dashboard account; never publish another session's pending rows. */
export function observeDashboardSession(client, { loadCampaigns, onChange }) {
  let alive = true;
  let revision = 0;
  let observedId;
  const empty = (phase) => ({ phase, user: null, campaigns: [], error: "" });

  async function verify(expectedId) {
    const ticket = ++revision;
    const current = () => alive && ticket === revision;
    onChange(empty("loading"));
    let user;
    try {
      const identity = await client.auth.getUser();
      if (!current()) return;
      if (identity.error && identity.error.name !== "AuthSessionMissingError")
        throw identity.error;
      user = identity.data?.user;
      if (!memberIdentity(user)) {
        observedId = null;
        onChange(empty("guest"));
        return;
      }
      if (expectedId !== undefined && user.id !== expectedId)
        throw new Error("Your account changed while verifying the dashboard.");
      observedId = user.id;
      onChange({ phase: "ready", user, campaigns: [], error: "" });
    } catch {
      if (current()) onChange(empty("error"));
      return;
    }

    try {
      const campaigns = await loadCampaigns();
      if (!current()) return;
      // The owner transport already verifies its response. Recheck the identity
      // again at this final UI boundary, including changes between its return
      // and this continuation, before associating rows with a visible account.
      const after = await client.auth.getUser();
      if (!current()) return;
      if (after.error || !memberIdentity(after.data?.user) || after.data.user.id !== user.id) {
        onChange(empty("error"));
        return;
      }
      onChange({ phase: "ready", user, campaigns, error: "" });
    } catch {
      if (current()) onChange({ phase: "ready", user, campaigns: [],
        error: "Your campaigns could not be loaded. Please try again." });
    }
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    if (!alive) return;
    const nextId = memberIdentity(session?.user) ? session.user.id : null;
    if (nextId === observedId) return;
    observedId = nextId;
    const ticket = ++revision;
    // Clear private rows synchronously, before the SDK callback lock releases.
    onChange(empty(nextId ? "loading" : "guest"));
    if (nextId) queueMicrotask(() => {
      if (alive && ticket === revision) void verify(nextId);
    });
  });
  void verify();
  return () => {
    alive = false;
    ++revision;
    data?.subscription?.unsubscribe();
  };
}
