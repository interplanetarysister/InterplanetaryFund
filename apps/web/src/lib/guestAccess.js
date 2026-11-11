// A Supabase anonymous session has a real server-side owner ID even without
// collecting an email. Never confuse it with an unauthenticated browser draft.
export const GUEST_NOTICE_KEY = "ifund-guest-onboarding-v1";
export function guestIdentity(user) {
  return Boolean(user?.id && user.is_anonymous === true);
}
export function memberIdentity(user) {
  return Boolean(user?.id && (guestIdentity(user) || user.email_confirmed_at));
}
export function payoutIdentity(user) {
  return Boolean(user?.id && !guestIdentity(user) && user.email_confirmed_at);
}
export function rememberGuestNotice(storage, version) {
  storage.setItem(GUEST_NOTICE_KEY, JSON.stringify({ terms_version: version, local_only: true }));
}
export function hasGuestNotice(storage, version) {
  try {
    const value = JSON.parse(storage.getItem(GUEST_NOTICE_KEY) || "null");
    return value?.terms_version === version && value?.local_only === true;
  } catch { return false; }
}

// Never fake a server user or receipt. Disabled anonymous auth means browser
// editor only; no cloud save, public publishing, or financial access.
export async function enterGuestMode({ auth, client, store, version, record }) {
  const current = await auth.getUser();
  if (current.error) throw current.error;
  if (current.data?.user?.id) {
    if (guestIdentity(current.data.user) || payoutIdentity(current.data.user)) {
      await record(client, current.data.user);
      return { mode: "account", user: current.data.user };
    }
    rememberGuestNotice(store, version);
    return { mode: "local", reason: "email-unconfirmed" };
  }
  try {
    const { data, error } = await auth.signInAnonymously();
    if (error) throw error;
    if (!guestIdentity(data?.user) || !data?.session?.access_token)
      throw new Error("Anonymous identity was not established.");
    await record(client, data.user);
    return { mode: "account", user: data.user };
  } catch (error) {
    // An actual account may have been created before the receipt insert failed:
    // don't downgrade it silently to a false browser-only 'success'.
    const retry = await auth.getUser();
    if (!retry.error && guestIdentity(retry.data?.user))
      throw new Error("The account was created but its legal agreement could not be saved. Retry before saving to the cloud.");
    rememberGuestNotice(store, version);
    return { mode: "local", reason: error?.message || "guest-auth-unavailable" };
  }
}
