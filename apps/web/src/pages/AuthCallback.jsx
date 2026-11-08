import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { completeAuthCallback } from "@/lib/authFlow";
import { safeReturnTo } from "@/lib/safeReturnTo";

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
      .then(async (result) => {
        if (!active) return;
        if (result.recovery) {
          navigate("/reset-password", { replace: true });
          return;
        }
        const client = authClient();
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError || !authData?.user?.id)
          throw new Error("The verified account could not be loaded.");
        const { data: profile, error: profileError } = await client
          .from("ifund_profiles")
          .select("handle")
          .eq("id", authData.user.id)
          .maybeSingle();
        if (profileError)
          throw new Error("The member profile could not be verified.");
        const target = result.returnTo.startsWith("/onboarding")
          ? safeReturnTo(new URL(result.returnTo, window.location.origin).searchParams.get("returnTo"))
          : result.returnTo;
        const destination =
          typeof profile?.handle === "string" && profile.handle.trim()
            ? target
            : "/onboarding?returnTo=" + encodeURIComponent(target);
        if (active) navigate(destination, { replace: true });
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
