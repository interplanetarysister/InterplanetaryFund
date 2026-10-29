// IFund password-account access requires a provider-confirmed email.
// Missing confirmation metadata fails closed; never infer verification from a session alone.
export function isVerifiedEmailUser(user) {
  return Boolean(user && typeof user.id === "string" && user.id && user.email_confirmed_at);
}
