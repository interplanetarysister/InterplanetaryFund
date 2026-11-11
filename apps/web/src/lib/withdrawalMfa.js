import { payoutIdentity } from "./guestAccess.js";

// Client-side assurance is an informative step-up signal only. The server must
// independently validate a signed aal2 JWT before any financial transfer.
export function hasWithdrawalAssurance(user, assuranceLevel) {
  return payoutIdentity(user) && assuranceLevel === "aal2";
}

export async function confirmWithdrawalFactor(auth, user, factorId, code) {
  if (!payoutIdentity(user)) throw new Error("A verified email account is required.");
  if (typeof factorId !== "string" || !factorId)
    throw new Error("A valid enrolled authenticator is required.");
  if (typeof code !== "string" || !/^\d{6}$/.test(code))
    throw new Error("Enter the six-digit code from your authenticator app.");
  const challenge = await auth.mfa.challenge({ factorId });
  if (challenge.error || !challenge.data?.id)
    throw challenge.error || new Error("Authenticator challenge is unavailable.");
  const verified = await auth.mfa.verify({
    factorId, challengeId: challenge.data.id, code,
  });
  if (verified.error) throw verified.error;
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || !hasWithdrawalAssurance(user, assurance.data?.currentLevel))
    throw new Error("Second-factor verification was not confirmed.");
  return true;
}
