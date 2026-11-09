import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { authClient } from "@/api/auth";

const API_BASE = (import.meta.env.VITE_IFUND_OAUTH_API_BASE_URL || "").replace(/\/+$/, "");
const PROVIDERS = new Set(["google", "youtube", "linkedin", "x", "tiktok", "facebook_pages", "instagram"]);

export default function OAuthCallback() {
  const { provider = "" } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Verifying your provider authorization…");

  useEffect(() => {
    let live = true;
    const storageKey = "ifund-oauth-callback-" + provider;
    let payload = null;
    try {
      const query = new URLSearchParams(window.location.search);
      if (query.has("error")) {
        window.sessionStorage.removeItem(storageKey);
        window.history.replaceState({}, "", window.location.pathname);
        setStatus("error");
        setMessage("Provider authorization was canceled or denied. Return to Connections to try again.");
        return () => { live = false; };
      }
      const code = query.get("code");
      const state = query.get("state");
      if (code && state) {
        payload = { code, state, scopes: query.get("scopes") || "" };
        window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
        window.history.replaceState({}, "", window.location.pathname);
      } else {
        const saved = window.sessionStorage.getItem(storageKey);
        payload = saved ? JSON.parse(saved) : null;
      }
    } catch {
      setStatus("error");
      setMessage("The provider response could not be read. Return to Connections and restart.");
      return () => { live = false; };
    }

    if (!PROVIDERS.has(provider) || !payload || typeof payload.code !== "string" || typeof payload.state !== "string") {
      setStatus("error");
      setMessage("The provider response is incomplete. Return to Connections and restart.");
      return () => { live = false; };
    }

    const finish = async () => {
      const client = authClient();
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        if (live) {
          setStatus("sign-in");
          setMessage("Sign in to the same IFund account to finish connecting this provider.");
        }
        return;
      }
      if (!API_BASE) throw new Error("The provider authorization service is not configured for this build.");
      const redirectUri = new URL("/oauth/callback/" + provider, window.location.origin).toString();
      const response = await fetch(API_BASE + "/api/oauth/" + provider + "/callback", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({
          code: payload.code,
          state: payload.state,
          scopes: payload.scopes || "",
          redirect_uri: redirectUri,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.status !== "connected") {
        throw new Error(result.error || "Provider authorization could not be verified.");
      }
      window.sessionStorage.removeItem(storageKey);
      if (live) {
        setStatus("success");
        setMessage("Connection verified. Returning to your Connections page…");
        navigate("/connections?oauth=connected&provider=" + encodeURIComponent(provider), { replace: true });
      }
    };

    finish().catch((finishError) => {
      window.sessionStorage.removeItem(storageKey);
      if (live) {
        setStatus("error");
        setMessage(finishError?.message || "Provider authorization could not be verified.");
      }
    });
    return () => { live = false; };
  }, [navigate, provider]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">IFund connections</p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">Provider authorization</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground" role="status" aria-live="polite">{message}</p>
        {status === "sign-in" && (
          <Link to={"/login?returnTo=" + encodeURIComponent("/oauth/callback/" + provider)}
            className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Sign in to finish
          </Link>
        )}
        {status === "error" && (
          <Link to="/connections" className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">
            Return to Connections
          </Link>
        )}
      </div>
    </main>
  );
}
