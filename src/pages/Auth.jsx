import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { Message } from "../components/UI";
import { safeReturnTo, signInWithPassword } from "../lib/authFlows";

const SIGN_IN_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "facebook", label: "Continue with Facebook" },
];

export default function Auth({ user }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(
    searchParams.get("returnTo"),
    window.location.origin,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("password");
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (user) {
    return (
      <main className="editor">
        <h1>Signed in</h1>
        <p>{user.email}</p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error: signOutError } = await db.auth.signOut();
            setBusy(false);
            if (signOutError) {
              setError("Unable to sign out. Please try again.");
            } else {
              navigate("/", { replace: true });
            }
          }}
        >
          Sign out
        </button>
        <Message error={Boolean(error)}>{error}</Message>
      </main>
    );
  }

  async function signIn(event) {
    event.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await signInWithPassword(db.auth, email, password);
      navigate(returnTo, { replace: true });
    } catch {
      setError(
        "Your email or password could not be verified. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signInWithProvider(provider) {
    if (!db || busy) return;
    setBusy(true);
    setError("");

    try {
      const callback = new URL("/login", window.location.origin);
      callback.searchParams.set("returnTo", returnTo);
      const { error: authError } = await db.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback.toString() },
      });
      if (authError) throw authError;
    } catch {
      setError("This sign-in provider is not available right now.");
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
        options: { shouldCreateUser: true },
      });
      if (authError) throw authError;
      setCodeRequested(true);
      setMessage("Check your email for a one-time sign-in code.");
    } catch {
      setError(
        "A sign-in code could not be requested. Wait a moment and try again.",
      );
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
    } catch {
      setError(
        "That sign-in code could not be verified. Request a new code and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="editor">
      <h1>Sign in to Interplanetary Fund</h1>
      <p>
        Use your email and password, a connected identity, or an email sign-in
        code.
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
        <div className="auth-divider" aria-hidden="true">
          or
        </div>
        {mode === "password" ? (
          <form onSubmit={signIn}>
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
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
            <button type="submit" disabled={!db || busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <Link to="/forgot-password">Forgot password?</Link>
          </form>
        ) : (
          <form onSubmit={codeRequested ? verifyCode : requestCode}>
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
            {codeRequested && (
              <label>
                One-time sign-in code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
            )}
            <button type="submit" disabled={!db || busy}>
              {busy
                ? "Please wait…"
                : codeRequested
                  ? "Verify code"
                  : "Email me a sign-in code"}
            </button>
          </form>
        )}
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "password" ? "email-code" : "password");
            setError("");
            setMessage("");
            setCodeRequested(false);
            setCode("");
          }}
        >
          {mode === "password"
            ? "Use an email sign-in code instead"
            : "Use my password instead"}
        </button>
        <Message error={Boolean(error)}>
          {error || message || (!db ? "Supabase is not yet configured." : "")}
        </Message>
      </div>
    </main>
  );
}
