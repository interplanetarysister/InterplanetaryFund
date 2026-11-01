const AUTH_MESSAGES = Object.freeze({
  login: "Unable to sign in. Please check your email and password or use the sign-in method you registered with.",
  register: "Registration failed. Please try again.",
  verify: "Invalid verification code. Please try again.",
  resend: "Failed to resend code. Please try again.",
  reset: "Failed to reset password. Please request a new link or try again."
});

export function safeAuthErrorMessage(kind) {
  return AUTH_MESSAGES[kind] || "Authentication failed. Please try again.";
}

// Categorize by HTTP status only: never display provider error text, account
// identifiers, raw headers or the submitted password in any UI response.
export function safeLoginFailureByStatus(status) {
  if (status === 400 || status === 401 || status === 403 || status === 422) {
    return AUTH_MESSAGES.login;
  }
  if (status === 429) {
    return "Too many login attempts. Please wait a few minutes before retrying.";
  }
  if (typeof status === "number" && status >= 500) {
    return "IFund sign-in is temporarily unavailable. Please try again shortly.";
  }
  return "Could not reach IFund sign-in. Check your connection and try again.";
}
