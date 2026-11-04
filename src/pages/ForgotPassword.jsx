import { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Message } from "../components/UI";
import { requestPasswordRecovery } from "../lib/authFlows";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setError("");

    try {
      const redirectTo = new URL(
        "/reset-password",
        window.location.origin,
      ).toString();
      await requestPasswordRecovery(db.auth, email, redirectTo);
      setSent(true);
    } catch {
      setError(
        "A recovery email could not be requested. Wait a moment and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="editor">
      <h1>Recover your password</h1>
      {sent ? (
        <>
          <p>
            If an account exists for this address, check your email for a
            recovery code or link.
          </p>
          <p>
            Enter the six-digit code on the next screen, or open the recovery
            link in the email.
          </p>
          <Link to="/reset-password">Continue to password recovery</Link>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <label>
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button type="submit" disabled={!db || busy}>
            {busy ? "Sending…" : "Send recovery email"}
          </button>
        </form>
      )}
      <Message error={Boolean(error)}>
        {error || (!db ? "Supabase is not yet configured." : "")}
      </Message>
      <Link to="/login">Back to sign in</Link>
    </main>
  );
}
