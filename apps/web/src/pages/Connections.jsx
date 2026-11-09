import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";

const API_BASE = (import.meta.env.VITE_IFUND_OAUTH_API_BASE_URL || "").replace(/\/+$/, "");
const PROVIDERS = [
  { id: "facebook_pages", name: "Facebook Pages", description: "Connect a Page you manage. Publishing requires approved Page permissions and content-creation access." },
  { id: "instagram", name: "Instagram Business", description: "Connect an Instagram professional account. Publishing and insights require approved business permissions." },
  { id: "youtube", name: "YouTube", description: "Connect a YouTube channel through Google. Upload access is enabled only after Google verification." },
  { id: "google", name: "Google Account", description: "Connect Google identity. Other Google products require their own approved scopes." },
  { id: "linkedin", name: "LinkedIn", description: "Connect LinkedIn identity. Posting requires the separately approved w_member_social permission." },
  { id: "tiktok", name: "TikTok", description: "Connect TikTok identity. Video upload is enabled only after TikTok app review." },
  { id: "x", name: "X", description: "User-level authorization is not enabled yet; the Base44 connector is currently shared-only.", unavailable: true },
  { id: "gofundme_pro", name: "GoFundMe Pro", description: "Organization-level API connection managed by IFund administrators; this is not per-user OAuth.", adminOnly: true },
  { id: "gofundme", name: "GoFundMe", description: "Consumer GoFundMe campaigns are added by campaign URL. GoFundMe Pro API access is separate.", linkOnly: true },
];
const ALIASES = {
  facebook_pages: ["facebook_pages", "facebook"],
  instagram: ["instagram", "instagram_business"],
  youtube: ["youtube", "youtube_channel"],
  google: ["google", "google_account"],
  linkedin: ["linkedin"],
  tiktok: ["tiktok"],
  x: ["x", "twitter"],
};
function getConnectionLabel(row) {
  if (!row) return "Not connected";
  if (row.status === "connected" && row.verified_at) return "Connected";
  if (row.status === "pending" || row.status === "connected") return "Pending verification";
  if (row.status === "error") return "Needs attention";
  return "Not connected";
}
function statusTone(label) {
  if (label === "Connected") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (label === "Needs attention") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (label === "Pending verification") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}
export default function Connections() {
  const [rows, setRows] = useState([]);
  const [recordStatus, setRecordStatus] = useState("loading");
  const [providerReady, setProviderReady] = useState({});
  const [apiStatus, setApiStatus] = useState("loading");
  const [connecting, setConnecting] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("oauth") !== "connected") return;
    const providerId = searchParams.get("provider") || "";
    const provider = PROVIDERS.find((item) => item.id === providerId);
    setMessage((provider?.name || "Provider") + " connection verified.");
    const clean = new URLSearchParams(searchParams);
    clean.delete("oauth");
    clean.delete("provider");
    setSearchParams(clean, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const client = authClient();
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          if (live) setRecordStatus("sign-in");
          return;
        }
        const { data, error: queryError } = await client
          .from("ifund_connections")
          .select("id,provider,status,verified_at,created_at")
          .eq("owner_id", session.user.id)
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;
        if (live) {
          setRows(data || []);
          setRecordStatus("ready");
        }
      } catch {
        if (live) setRecordStatus("error");
      }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!API_BASE) {
        if (live) setApiStatus("unconfigured");
        return;
      }
      try {
        const client = authClient();
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.access_token) {
          if (live) setApiStatus("sign-in");
          return;
        }
        const response = await fetch(API_BASE + "/api/oauth/status", {
          headers: { Authorization: "Bearer " + session.access_token },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.enabled !== true) {
          throw new Error(payload.error || "Provider authorization is not enabled in this environment.");
        }
        if (live) {
          setProviderReady(payload.providers || {});
          setApiStatus("ready");
        }
      } catch {
        if (live) setApiStatus("unavailable");
      }
    })();
    return () => { live = false; };
  }, []);

  const rowsByProvider = useMemo(() => new Map(
    PROVIDERS.map((provider) => {
      const aliases = ALIASES[provider.id] || [provider.id];
      return [provider.id, rows.find((row) => aliases.includes(row.provider)) || null];
    })
  ), [rows]);

  const connect = useCallback(async (providerId) => {
    if (connecting) return;
    if (!API_BASE || apiStatus !== "ready" || providerReady[providerId] !== true) {
      setError("This provider is not configured for user connections in this environment yet.");
      return;
    }
    setConnecting(providerId);
    setError("");
    try {
      const client = authClient();
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Sign in again before connecting a provider.");
      const response = await fetch(API_BASE + "/api/oauth/" + providerId + "/start", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.authorization_url !== "string") {
        throw new Error(payload.error || "Could not start provider authorization.");
      }
      window.location.assign(payload.authorization_url);
    } catch (connectError) {
      setError(connectError?.message || "Could not start provider authorization.");
      setConnecting("");
    }
  }, [apiStatus, connecting, providerReady]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Account</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Connected platforms</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Connect your own accounts securely. IFund verifies each connection before showing it as active.
          </p>
        </div>
        <Link to="/profile" className="text-sm font-medium text-primary hover:underline">Back to profile</Link>
      </div>
      {message && (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">{message}</div>
      )}
      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {apiStatus === "unconfigured" && (
        <div role="status" className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          The provider authorization API is not configured for this build yet. Existing connection records remain visible.
        </div>
      )}
      {apiStatus === "unavailable" && (
        <div role="status" className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          Secure provider authorization is not enabled in this environment yet. Connect buttons stay disabled until server-side credentials and approvals are verified.
        </div>
      )}
      {recordStatus === "loading" && <p className="mt-6 text-sm text-muted-foreground">Loading your connection records…</p>}
      {recordStatus === "sign-in" && <p className="mt-6 text-sm text-muted-foreground"><Link to="/login" className="text-primary hover:underline">Sign in</Link> to view your connections.</p>}
      {recordStatus === "error" && <p role="alert" className="mt-6 text-sm text-destructive">Connection records are unavailable.</p>}
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const row = rowsByProvider.get(provider.id);
          const label = provider.adminOnly ? "Admin setup" : provider.linkOnly ? "Campaign URL" : provider.unavailable ? "Not enabled" : getConnectionLabel(row);
          const ready = providerReady[provider.id] === true;
          const canConnect = !provider.adminOnly && !provider.linkOnly && !provider.unavailable &&
            ready && apiStatus === "ready" && recordStatus === "ready" && !connecting;
          return (
            <section key={provider.id} className="flex min-h-48 flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">{provider.name}</h2>
                  <span className={"shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium " + statusTone(label)}>{label}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{provider.description}</p>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                {provider.adminOnly ? <span className="text-xs text-muted-foreground">Admin-managed integration</span>
                  : provider.linkOnly ? <span className="text-xs text-muted-foreground">Add a campaign link when creating a campaign</span>
                  : provider.unavailable ? <span className="text-xs text-muted-foreground">User authorization is disabled</span>
                  : ready ? <span className="text-xs text-muted-foreground">Secure authorization available</span>
                  : <span className="text-xs text-muted-foreground">Provider setup pending</span>}
                {!provider.adminOnly && !provider.linkOnly && !provider.unavailable && (
                  <button type="button" onClick={() => connect(provider.id)} disabled={!canConnect}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
                    {connecting === provider.id ? "Opening…" : row ? "Reconnect" : "Connect"}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
