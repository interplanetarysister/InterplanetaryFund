import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { safeReturnTo } from "../lib/authReturnTo";
import { db } from "../lib/supabase";
import { Message } from "../components/UI";

const PROVIDER_LABELS = {
  google: "Continue with Google",
  facebook: "Continue with Facebook",
};
const SIGN_IN_PROVIDERS = (import.meta.env.VITE_SUPABASE_OAUTH_PROVIDERS || "")
  .split(",")
  .map((provider) => provider.trim().toLowerCase())
  .filter((provider) => Object.hasOwn(PROVIDER_LABELS, provider))
  .map((id) => ({ id, label: PROVIDER_LABELS[id] }));

/**
 * Existing accounts can sign in with a password or passwordless email link/code.
 * Password signup remains disabled. OAuth buttons are shown only for providers
 * explicitly enabled in the deployment environment. Instagram remains a
 * post-sign-in social connection, not a sign-in provider.
 */
export default function Auth({ user }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("email");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function switchAuthMode(nextMode) {
    setAuthMode(nextMode);
    setPassword("");
    setCode("");
    setCodeRequested(false);
    setMessage("");
    setError("");
  }

  async function signOut() {
    if (!db || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await db.auth.signOut();
      if (signOutError) throw signOutError;
      navigate("/login", { replace: true });
    } catch {
      setError("We could not complete sign-out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <main>
        <h1>Signed in</h1>
        <p>{user.email}</p>
        <div className="actions">
          <Link className="primary" to={returnTo}>Continue to your destination</Link>
          <button type="button" disabled={busy} onClick={signOut}>Sign out</button>
        </div>
        <Message error>{error}</Message>
      </main>
    );
  }

  async function signInWithProvider(provider) {
    if (!db || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await db.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + "/login?returnTo=" + encodeURIComponent(returnTo) },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError?.message || "Social sign-in is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword(event) {
    event.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: authError } = await db.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      navigate(returnTo, { replace: true });
    } catch {
      setError("Email or password is incorrect. Try again or use an email sign-in link.");
    } finally {
      setBusy(false);
    }
  }

  async function requestCode(event) {
    event.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: authError } = await db.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo:
            window.location.origin +
            "/login?returnTo=" +
            encodeURIComponent(returnTo),
        },
      });
      if (authError) throw authError;
      setCodeRequested(true);
      setMessage(
        "Check your email for a sign-in link or one-time code. Open the link, or enter the code below.",
      );
    } catch (authError) {
      setError(authError?.message || "Unable to request a sign-in link or code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await db.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (authError) throw authError;
      navigate(returnTo, { replace: true });
    } catch (authError) {
      setError(authError?.message || "That code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  const submit = authMode === "password"
    ? signInWithPassword
    : codeRequested
      ? verifyCode
      : requestCode;

  return (
    <main className="editor">
      <h1>Sign in to Interplanetary Fund</h1>
      <p>
        {SIGN_IN_PROVIDERS.length
          ? "Use a connected identity, your password, or a one-time email sign-in link/code."
          : "Use your password or a one-time email sign-in link/code."}
      </p>
      <div className="form">
        {SIGN_IN_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={!db || busy}
            onClick={() => signInWithProvider(provider.id)}
          >
            {provider.label}
          </button>
        ))}
        <div className="actions" aria-label="Sign-in method">
          <button
            type="button"
            aria-pressed={authMode === "email"}
            disabled={!db || busy}
            onClick={() => switchAuthMode("email")}
          >
            Email link or code
          </button>
          <button
            type="button"
            aria-pressed={authMode === "password"}
            disabled={!db || busy}
            onClick={() => switchAuthMode("password")}
          >
            Password
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setCodeRequested(false);
                setCode("");
              }}
            />
          </label>
          {authMode === "password" ? (
            <label>
              Password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : (
            codeRequested && (
              <label>
                One-time code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
            )
          )}
          <button type="submit" disabled={!db || busy}>
            {authMode === "password"
              ? "Sign in with password"
              : codeRequested
                ? "Verify code"
                : "Email me a sign-in link or code"}
          </button>
        </form>
        <Message error={Boolean(error)}>
          {error || message || (!db ? "Supabase is not yet configured." : "")}
        </Message>
      </div>
    </main>
  );
}
