import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { completeAuthCallback } from "@/lib/authFlow";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [href] = useState(() => window.location.href);
  useEffect(() => {
    let active = true;
    // Strip credentials before loading any further pages or third-party assets.
    window.history.replaceState({}, "", "/auth/callback");
    Promise.resolve()
      .then(() => completeAuthCallback(authClient().auth, href))
      .then((result) => {
        if (active)
          navigate(result.recovery ? "/reset-password" : result.returnTo, {
            replace: true,
          });
      })
      .catch(() => {
        if (active)
          setError(
            "This sign-in link could not be verified. Request another email or enter the confirmation code on the signup page.",
          );
      });
    return () => {
      active = false;
    };
  }, [navigate, href]);
  return (
    <main className="ifund-public min-h-dvh p-8 text-white">
      <section className="mx-auto max-w-md space-y-5">
        <h1 className="text-2xl">Confirming your account</h1>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p role="status">Verifying your email…</p>
        )}
        <Link className="underline" to="/login">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}
