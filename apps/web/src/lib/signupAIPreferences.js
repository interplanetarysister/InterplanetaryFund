// Explicit choices selected on the registration screen are scoped to one verified
// email account. Future features and all external OAuth grants remain separate.
export const SIGNUP_AI_CHOICES_KEY = "ifund-signup-ai-interest-v1";
const ALLOWED = ["allow_ai_campaign_drafts", "allow_ai_outreach_drafts", "interested_in_future_automation"];
const DAY_MS = 86400000;

export function rememberSignupAIChoices(storage, email, choices, at = Date.now()) {
  storage.setItem(SIGNUP_AI_CHOICES_KEY, JSON.stringify({
    email: String(email || "").trim().toLowerCase(),
    timestamp: at,
    choices: Object.fromEntries(ALLOWED.map(key => [key, choices?.[key] === true])),
  }));
}

/** Only called after successful legal acceptance for this exact signup. */
export async function finalizeSignupAIChoices(client, user, storage, now = Date.now()) {
  let pending;
  try { pending = JSON.parse(storage.getItem(SIGNUP_AI_CHOICES_KEY) || "null"); }
  catch { return false; }
  if (!user?.id || user.is_anonymous === true || !user.email_confirmed_at ||
      !pending || pending.email !== user.email?.trim().toLowerCase() ||
      typeof pending.timestamp !== "number" ||
      pending.timestamp > now || now - pending.timestamp > DAY_MS)
    return false;
  const existing = await client.from("ifund_ai_permission_preferences")
    .select("owner_id").eq("owner_id", user.id).maybeSingle();
  if (existing.error) throw existing.error;
  // A fresh signup preference must never overwrite changes already saved in My Profile.
  if (existing.data) {
    storage.removeItem(SIGNUP_AI_CHOICES_KEY);
    return true;
  }
  const row = {
    owner_id: user.id,
    default_action: "ask",
    ...Object.fromEntries(ALLOWED.map(key => [key, pending.choices?.[key] === true])),
  };
  const { data, error } = await client.from("ifund_ai_permission_preferences")
    .upsert(row, { onConflict: "owner_id", ignoreDuplicates: true })
    .select("owner_id").maybeSingle();
  if (error) throw error;
  if (!data) {
    const check = await client.from("ifund_ai_permission_preferences")
      .select("owner_id").eq("owner_id", user.id).maybeSingle();
    if (check.error || check.data?.owner_id !== user.id)
      throw new Error("AI permissions were not confirmed for your account.");
  } else if (data.owner_id !== user.id) {
    throw new Error("AI permissions were not confirmed for your account.");
  }
  storage.removeItem(SIGNUP_AI_CHOICES_KEY);
  return true;
}
