import { TERMS_VERSION } from "./legalPolicy.js";

// A temporary, same-browser marker for an agreement explicitly selected
// before signup. No passwords or authentication tokens are stored here.
export const PENDING_SIGNUP_AGREEMENT = "ifund-pending-signup-agreement";

export function rememberSignupAgreement(storage, email) {
  storage.setItem(PENDING_SIGNUP_AGREEMENT, JSON.stringify({
    version: TERMS_VERSION,
    email: String(email || "").trim().toLowerCase(),
  }));
}

export async function recordLegalAcceptance(client, user) {
  if (!user?.id || (!user?.email_confirmed_at && user?.is_anonymous !== true))
    throw new Error("A current Supabase member session is required to record the agreement.");
  const read = () => client.from("ifund_legal_acceptances")
    .select("owner_id,terms_version,explicit_consent")
    .eq("owner_id", user.id)
    .eq("terms_version", TERMS_VERSION)
    .maybeSingle();
  const first = await read();
  if (first.error) throw first.error;
  if (first.data?.owner_id === user.id && first.data.explicit_consent === true) return true;
  const { error } = await client.from("ifund_legal_acceptances").insert({
    owner_id: user.id, terms_version: TERMS_VERSION, explicit_consent: true,
  });
  if (error && error.code !== "23505") throw error;
  const verified = await read();
  if (verified.error || verified.data?.owner_id !== user.id ||
    verified.data?.explicit_consent !== true)
    throw new Error("The agreement was not saved. Please confirm it on your dashboard.");
  return true;
}

export async function finalizeSignupAgreement(client, user, storage) {
  let pending;
  try { pending = JSON.parse(storage.getItem(PENDING_SIGNUP_AGREEMENT) || "null"); }
  catch { return false; }
  if (!pending || pending.version !== TERMS_VERSION ||
      !user?.email || pending.email !== user.email.trim().toLowerCase())
    return false;
  await recordLegalAcceptance(client, user);
  storage.removeItem(PENDING_SIGNUP_AGREEMENT);
  return true;
}
