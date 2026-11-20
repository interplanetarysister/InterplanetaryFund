import { hasUnifiedAIConsent, AI_CONSENT_FIELDS } from "../apps/web/src/lib/unifiedAIConsent.mjs";

// An authenticated user's current saved AI preference is checked before every
// model invocation. Supabase RLS and the verified account JWT scope the read.
// No cached browser flag, signup interest, or paid membership is a substitute.
export async function verifyOwnerAIConsent(env, account, fetcher = fetch) {
  if (!account?.uid || !account?.jwt) return { allowed: false, status: 401 };
  if (env?.SUPABASE_URL !== "https://ssibsfmtodgximseeqsv.supabase.co" ||
      typeof env.SUPABASE_PUBLISHABLE_KEY !== "string")
    return { allowed: false, status: 503 };
  try {
    const params = new URLSearchParams({
      select: ["owner_id", ...AI_CONSENT_FIELDS].join(","),
      owner_id: "eq." + account.uid,
    });
    const result = await fetcher(env.SUPABASE_URL + "/rest/v1/ifund_ai_permission_preferences?" + params, {
      method: "GET", redirect: "manual", signal: AbortSignal.timeout(10000),
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: "Bearer " + account.jwt,
        Accept: "application/json",
      },
    });
    if (!result.ok) return { allowed: false, status: 503 };
    const rows = await result.json();
    if (!Array.isArray(rows) || rows.length > 1) return { allowed: false, status: 503 };
    return { allowed: rows.length === 1 && hasUnifiedAIConsent(rows[0], account.uid),
      status: rows.length === 1 && hasUnifiedAIConsent(rows[0], account.uid) ? 200 : 403 };
  } catch {
    return { allowed: false, status: 503 };
  }
}
