import { payoutIdentity } from "./guestAccess.js";

export async function assertSameVerifiedOwner(auth, ownerId) {
  const { data, error } = await auth.getUser();
  if (error || !payoutIdentity(data?.user) || data.user.id !== ownerId)
    throw new Error("Your account changed. Reload before continuing.");
}

/** A scope is permanently invalidated after an owner change or unmount. */
export function createOwnerSessionGuard(auth, ownerId, onInvalidate = () => {}) {
  let active = true;
  function invalidate() {
    if (!active) return;
    active = false;
    onInvalidate();
  }
  const { data } = auth.onAuthStateChange((_event, session) => {
    if (!payoutIdentity(session?.user) || session.user.id !== ownerId) invalidate();
  });
  const check = async () => {
    if (!active) throw new Error("Your account changed. Reload before continuing.");
    try { await assertSameVerifiedOwner(auth, ownerId); }
    catch (error) { invalidate(); throw error; }
    if (!active) throw new Error("Your account changed. Reload before continuing.");
  };
  return {
    async run(operation) {
      await check();
      const result = await operation();
      await check();
      return result;
    },
    dispose() { active = false; data?.subscription?.unsubscribe(); },
  };
}

/** Ignore an initial identity request when a newer auth event already won. */
export function observeWithdrawalIdentity(auth, onChange) {
  let active = true, revision = 0;
  const { data: subscription } = auth.onAuthStateChange((_event, session) => {
    ++revision;
    if (active) onChange({ phase: "ready", user: session?.user || null });
  });
  const ticket = revision;
  auth.getUser().then(({ data, error }) => {
    if (!active || ticket !== revision) return;
    onChange({ phase: error && error.name !== "AuthSessionMissingError" ? "error" : "ready",
      user: error ? null : data?.user || null });
  }).catch(() => {
    if (active && ticket === revision) onChange({ phase: "error", user: null });
  });
  return () => { active = false; ++revision; subscription?.subscription?.unsubscribe(); };
}
