import { useEffect, useState } from "react";
import { platforms } from "../lib/platforms";
import { db } from "../lib/supabase";

const OAUTH_PROVIDERS = new Set([
  "google",
  "youtube",
  "linkedin",
  "x",
  "tiktok",
  "facebook_pages",
  "instagram",
]);
const PROVIDER_DESCRIPTIONS = {
  google:
    "Connect Google identity. Drive, Calendar and other Google services require their own approved scopes.",
  youtube:
    "Connect a YouTube channel. Upload capability depends on Google OAuth verification and granted YouTube scopes.",
  linkedin:
    "Connect LinkedIn. Publishing requires the approved w_member_social permission.",
  x: "Connect X for approved read access. Publishing remains disabled until API plan entitlement is verified.",
  tiktok:
    "Connect TikTok profile and approved video capabilities. Additional scopes require TikTok app approval.",
  facebook_pages:
    "Connect Facebook Pages. Publishing requires approved Page permissions and a Page with content-creation access.",
  instagram:
    "Connect an Instagram business account. Publishing and insights depend on approved Instagram business scopes.",
  gofundme_pro:
    "GoFundMe Pro uses an organization-level API client, not per-user OAuth. API app credentials and organization approval are still required.",
};
const STATUS_LABELS = {
  connected: "Connected",
  pending: "Verification pending",
  error: "Needs attention",
  disconnected: "Not connected",
};

export default function Connections() {
  const [statuses, setStatuses] = useState({});
  const [busyProvider, setBusyProvider] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("oauth");
    const provider = params.get("provider");

    if (outcome === "connected" && provider) {
      setMessage(provider + " was connected and verified.");
    } else if (outcome === "failed" || outcome === "denied") {
      setError(
        outcome === "denied"
          ? "The provider authorization was declined."
          : "The provider connection could not be verified.",
      );
    }

    if (outcome) {
      params.delete("oauth");
      params.delete("provider");
      const query = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (query ? "?" + query : ""),
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadConnections() {
      if (!db) return;
      const { data } = await db.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      try {
        const response = await fetch("/api/account/connections", {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (!response.ok) return;
        const rows = await response.json();
        if (!active || !Array.isArray(rows)) return;
        setStatuses(
          Object.fromEntries(rows.map((row) => [row.provider, row.status])),
        );
      } catch {
        if (active) setError("Connection status is temporarily unavailable.");
      }
    }

    loadConnections();
    return () => {
      active = false;
    };
  }, []);

  async function connect(provider) {
    if (!db || busyProvider) return;
    setBusyProvider(provider);
    setError("");
    setMessage("");

    try {
      const { data, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in before connecting a platform.");

      const response = await fetch("/api/oauth/" + provider + "/start", {
        method: "POST",
        headers: { authorization: "Bearer " + token },
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.authorization_url !== "string") {
        throw new Error(
          payload.error || "Provider authorization is not configured yet.",
        );
      }
      window.location.assign(payload.authorization_url);
    } catch (connectionError) {
      setError(
        connectionError?.message || "Could not start provider authorization.",
      );
      setBusyProvider("");
    }
  }

  return (
    <main>
      <h1>Connections</h1>
      <p>
        Connect the platforms you use to share campaigns and manage approved
        fundraising workflows. A connection is shown as verified only after the
        provider authorizes access and IFund confirms the account identity.
      </p>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="cards">
        {platforms.map((platform) => {
          const supported = OAUTH_PROVIDERS.has(platform.id);
          const status = statuses[platform.id] || "disconnected";
          const statusLabel = STATUS_LABELS[status] || "Not connected";

          return (
            <section className="card" key={platform.id}>
              <h3>{platform.name}</h3>
              <span className="pill">{statusLabel}</span>
              <p>
                {PROVIDER_DESCRIPTIONS[platform.id] ||
                  (supported
                    ? "Secure account authorization with server-side token storage."
                    : "Connection setup is not enabled for this provider yet.")}
              </p>
              {supported && (
                <button
                  type="button"
                  disabled={
                    !db || Boolean(busyProvider) || status === "connected"
                  }
                  onClick={() => connect(platform.id)}
                >
                  {busyProvider === platform.id
                    ? "Connecting…"
                    : status === "connected"
                      ? "Connected"
                      : "Connect"}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
