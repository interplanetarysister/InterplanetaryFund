import { payoutIdentity } from "./guestAccess.js";
import { createOwnerSessionGuard } from "./ownerSessionGuard.js";

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
  const scope = createOwnerSessionGuard(auth, user.id);
  try {
    const challenge = await scope.run(() => auth.mfa.challenge({ factorId }));
    scope.assertActive();
    if (challenge.error || !challenge.data?.id)
      throw challenge.error || new Error("Authenticator challenge is unavailable.");
    const verified = await scope.run(() => auth.mfa.verify({
      factorId, challengeId: challenge.data.id, code,
    }));
    scope.assertActive();
    if (verified.error) throw verified.error;
    const assurance = await scope.run(() => auth.mfa.getAuthenticatorAssuranceLevel());
    scope.assertActive();
    if (assurance.error || !hasWithdrawalAssurance(user, assurance.data?.currentLevel))
      throw new Error("Second-factor verification was not confirmed.");
    return true;
  } finally {
    scope.dispose();
  }
}
