// Campaign mutation consent is a server-side authorization requirement.
// The version must match apps/web/src/lib/legalPolicy.js and the immutable
// owner-scoped public.ifund_legal_acceptances RLS contract.
export const CURRENT_TERMS_VERSION = "2026-10-13-v3";

export async function verifyLegalConsent(account, env, fetcher = fetch) {
  if (!account?.uid || !account?.jwt)
    return { status: 401, error: "Sign in to continue." };
  const query = new URLSearchParams({
    select: "owner_id,terms_version,explicit_consent,accepted_at",
    owner_id: "eq." + account.uid,
    terms_version: "eq." + CURRENT_TERMS_VERSION,
    limit: "2",
  });
  try {
    const upstream = await fetcher(env.SUPABASE_URL + "/rest/v1/ifund_legal_acceptances?" + query, {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + account.jwt,
        Accept: "application/json",
      },
      redirect: "error",
    });
    if (!upstream.ok) return { status: 503, error: "Agreement verification unavailable." };
    const rows = await upstream.json();
    if (!Array.isArray(rows) || rows.length > 2)
      return { status: 503, error: "Agreement verification unavailable." };
    if (rows.length === 0)
      return { status: 403, error: "Accept the current user agreement before changing campaigns." };
    if (rows.length !== 1 ||
        rows[0]?.owner_id !== account.uid ||
        rows[0]?.terms_version !== CURRENT_TERMS_VERSION)
      return { status: 503, error: "Agreement verification unavailable." };
    if (rows[0].explicit_consent !== true ||
        typeof rows[0].accepted_at !== "string" ||
        !Number.isFinite(Date.parse(rows[0].accepted_at)))
      return { status: 403, error: "Accept the current user agreement before changing campaigns." };
    return null;
  } catch {
    return { status: 503, error: "Agreement verification unavailable." };
  }
}
