const DEFAULT_RETURN_TO = "/mine";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function safeReturnTo(value, origin, fallback = DEFAULT_RETURN_TO) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.username || target.password) {
      return fallback;
    }
    return target.pathname + target.search + target.hash;
  } catch {
    return fallback;
  }
}

export async function signInWithPassword(auth, email, password) {
  const address = normalizeEmail(email);
  if (!address || typeof password !== "string" || !password) {
    throw new TypeError("Enter your email address and password.");
  }

  const { data, error } = await auth.signInWithPassword({
    email: address,
    password,
  });
  if (error) throw error;
  if (!data?.session?.access_token) {
    throw new Error("The sign-in session could not be verified.");
  }
  return data;
}

export async function requestPasswordRecovery(auth, email, redirectTo) {
  const address = normalizeEmail(email);
  if (!address) {
    throw new TypeError("Enter the email address for your account.");
  }

  const { error } = await auth.resetPasswordForEmail(address, { redirectTo });
  if (error) throw error;

  // Deliberately return the same success result for known and unknown addresses.
  return { requested: true };
}

export async function establishRecoverySession(auth, href) {
  const url = new URL(href);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (tokenHash && type === "recovery") {
    const { error } = await auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (error) throw error;
  }

  const { data, error } = await auth.getSession();
  if (error) throw error;

  return {
    ready: Boolean(data?.session),
    hasCallbackCredentials: Boolean(code || tokenHash),
  };
}

export async function completePasswordRecovery(
  auth,
  {
    email,
    token,
    password,
    confirmPassword,
    hasRecoverySession = false,
  },
) {
  if (typeof password !== "string" || password.length < 8) {
    throw new TypeError("Choose a password with at least 8 characters.");
  }
  if (password !== confirmPassword) {
    throw new TypeError("The passwords do not match.");
  }

  let verified = hasRecoverySession;
  if (!verified) {
    const address = normalizeEmail(email);
    const code = typeof token === "string" ? token.trim() : "";
    if (!address || !/^\d{6}$/.test(code)) {
      throw new TypeError("Enter the email address and six-digit recovery code.");
    }

    const { data, error } = await auth.verifyOtp({
      email: address,
      token: code,
      type: "recovery",
    });
    if (error) throw error;
    verified = Boolean(data?.session);
  }

  if (!verified) {
    throw new Error("The recovery session could not be verified.");
  }

  const { error: updateError } = await auth.updateUser({ password });
  if (updateError) throw updateError;

  // Password update is authoritative. A sign-out failure must not falsely
  // report that the password update itself failed.
  await auth.signOut().catch(() => undefined);
  return { updated: true };
}
