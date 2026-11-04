import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../lib/supabase";
import { Message } from "../components/UI";
import {
  completePasswordRecovery,
  establishRecoverySession,
} from "../lib/authFlows";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [linkSession, setLinkSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!db) {
        if (active) {
          setChecking(false);
          setError("Supabase is not yet configured.");
        }
        return;
      }

      try {
        const result = await establishRecoverySession(
          db.auth,
          window.location.href,
        );
        if (!active) return;

        setLinkSession(result.ready);
        if (result.hasCallbackCredentials && result.ready) {
          window.history.replaceState({}, "", "/reset-password");
        }
      } catch {
        if (active) {
          setError(
            "The recovery link could not be verified. Request a new recovery email.",
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    initialize();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!db || busy || checking) return;
    setBusy(true);
    setError("");

    try {
      await completePasswordRecovery(db.auth, {
        email,
        token: code,
        password,
        confirmPassword,
        hasRecoverySession: linkSession,
      });
      navigate("/login", { replace: true });
    } catch (failure) {
      if (failure instanceof TypeError) {
        setError(failure.message);
      } else {
        setError(
          "The recovery code or link could not be verified, or the password could not be updated. Request a new recovery email and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="editor">
      <h1>Choose a new password</h1>
      {checking ? (
        <p role="status">Checking your recovery link…</p>
      ) : (
        <form className="form" onSubmit={submit}>
          {!linkSession && (
            <>
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
              <label>
                Six-digit recovery code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </label>
            </>
          )}
          <label>
            New password
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button type="submit" disabled={!db || busy || checking}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
      <Message error={Boolean(error)}>{error}</Message>
      <Link to="/forgot-password">Request another recovery email</Link>
      {" · "}
      <Link to="/login">Back to sign in</Link>
    </main>
  );
}
