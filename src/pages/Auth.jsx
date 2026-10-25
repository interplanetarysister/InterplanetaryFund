import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/supabase";
import { Message } from "../components/UI";

const SIGN_IN_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "facebook", label: "Continue with Facebook" },
];

/**
 * Passwordless sign-in preview. Provider configuration, consent and the email
 * template containing {{ .Token }} must be approved before production use.
 * Instagram remains a post-sign-in social connection, not a sign-in provider.
 */
export default function Auth({ user }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (user) {
    return (
      <main>
        <h1>Signed in</h1>
        <p>{user.email}</p>
        <button type="button" onClick={() => db?.auth.signOut()}>
          Sign out
        </button>
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
        options: { redirectTo: window.location.origin + "/login" },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError?.message || "Social sign-in is unavailable.");
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
        options: { shouldCreateUser: true },
      });
      if (authError) throw authError;
      setCodeRequested(true);
      setMessage("Check your inbox for your sign-in code.");
    } catch (authError) {
      setError(authError?.message || "Unable to request a sign-in code.");
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
      navigate("/mine");
    } catch (authError) {
      setError(authError?.message || "That code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="editor">
      <h1>Sign in to Interplanetary Fund</h1>
      <p>
        Use your connected identity or a one-time email code. Passwords are not
        required.
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
              One-time code
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
            {codeRequested ? "Verify code" : "Email me a sign-in code"}
          </button>
        </form>
        <Message error={Boolean(error)}>
          {error || message || (!db ? "Supabase is not yet configured." : "")}
        </Message>
      </div>
    </main>
  );
}
