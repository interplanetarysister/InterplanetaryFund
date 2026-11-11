import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

const PROVIDERS = [
  { id: "facebook_pages", name: "Facebook Pages", description: "Connect a Page you manage. Publishing requires approved Page permissions and content-creation access." },
  { id: "instagram", name: "Instagram Business", description: "Connect an Instagram professional account. Publishing and insights require approved business permissions." },
  { id: "youtube", name: "YouTube", description: "Connect a YouTube channel through Google. Upload access is enabled only after Google verification." },
  { id: "google", name: "Google Account", description: "Connect Google identity. Other Google products require their own approved scopes." },
  { id: "linkedin", name: "LinkedIn", description: "Connect LinkedIn identity. Posting requires the separately approved w_member_social permission." },
  { id: "tiktok", name: "TikTok", description: "Connect TikTok identity. Video upload is enabled only after TikTok app review." },
  { id: "x", name: "X", description: "Connect your own X account. Read access depends on X developer-app approval; publishing requires separate API access approval." },
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
  const [action, setAction] = useState(null);
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const busy = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setRecordStatus("loading");
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
  }, [reload]);

  useEffect(() => {
    let live = true;
    setApiStatus("loading");
    setProviderReady({});
    (async () => {
      try {
        const client = authClient();
        const { data: { session }, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.access_token) {
          if (live) setApiStatus("sign-in");
          return;
        }
        const response = await fetch("/api/oauth/status", {
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
  }, [reload]);

  const rowsByProvider = useMemo(() => new Map(
    PROVIDERS.map((provider) => {
      const aliases = ALIASES[provider.id] || [provider.id];
      return [provider.id, rows.find((row) => aliases.includes(row.provider)) || null];
    })
  ), [rows]);

  async function manage(provider, operation) {
    if (busy.current || (operation !== "disconnect" && providerReady[provider.id] !== true)) return;
    busy.current = true;
    setAction({ id: provider.id, operation });
    setError("");
    setNotice("");
    let leaving = false;
    try {
      const { data: { session }, error: sessionError } = await authClient().auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Sign in again to manage connections.");
      const response = await fetch("/api/oauth/" + provider.id + "/" + operation, {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The connection action could not be completed.");
      if (operation === "start") {
        const destination = new URL(payload.authorization_url);
        if (destination.protocol !== "https:" || destination.username || destination.password) {
          throw new Error("Provider authorization could not be opened.");
        }
        window.location.assign(destination.href);
        leaving = true;
      } else {
        const expected = operation === "disconnect" ? "disconnected" : "connected";
        if (payload.provider !== provider.id || payload.status !== expected) {
          throw new Error("The updated connection could not be verified.");
        }
        setConfirm("");
        setNotice(operation === "disconnect"
          ? provider.name + " was disconnected from iFund. You can remove iFund’s permission in your provider account settings."
          : provider.name + " connection refreshed.");
        setReload(value => value + 1);
      }
    } catch (cause) {
      setError(cause.message || "The connection action could not be completed.");
    } finally {
      if (!leaving) {
        busy.current = false;
        setAction(null);
      }
    }
  }

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
      {notice && <p role="status" className="mt-5 rounded-xl border border-border bg-card p-3 text-sm">{notice}</p>}
      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {apiStatus === "unavailable" && (
        <div role="status" className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          New authorizations are unavailable. You can still view and disconnect saved iFund connections.
        </div>
      )}
      {recordStatus === "loading" && <p className="mt-6 text-sm text-muted-foreground">Loading your connection records…</p>}
      {recordStatus === "sign-in" && <p className="mt-6 text-sm text-muted-foreground"><Link to="/login" className="text-primary hover:underline">Sign in</Link> to view your connections.</p>}
      {recordStatus === "error" && <div className="mt-6 space-y-2"><p role="alert" className="text-sm text-destructive">Connection records are unavailable.</p><button type="button" className="min-h-11 underline" onClick={() => setReload(value => value + 1)}>Retry loading connections</button></div>}
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const row = rowsByProvider.get(provider.id);
          const label = provider.adminOnly ? "Admin setup" : provider.linkOnly ? "Campaign URL" : provider.unavailable ? "Not enabled" : getConnectionLabel(row);
          const ready = providerReady[provider.id] === true;
          const canConnect = !provider.adminOnly && !provider.linkOnly && !provider.unavailable &&
            ready && apiStatus === "ready" && recordStatus === "ready" && !action;
          const manageable = row?.provider === provider.id && row.status !== "disconnected";
          return (
            <section key={provider.id} className="flex min-h-48 flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-foreground">{provider.name}</h2>
                  <span className={"shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium " + statusTone(label)}>{label}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{provider.description}</p>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                {provider.adminOnly ? <span className="text-xs text-muted-foreground">Admin-managed integration</span>
                  : provider.linkOnly ? <span className="text-xs text-muted-foreground">Add a campaign link when creating a campaign</span>
                  : provider.unavailable ? <span className="text-xs text-muted-foreground">User authorization is disabled</span>
                  : ready ? <span className="text-xs text-muted-foreground">Secure authorization available</span>
                  : <span className="text-xs text-muted-foreground">Provider setup pending</span>}
                {!provider.adminOnly && !provider.linkOnly && !provider.unavailable && (
                  <button type="button" onClick={() => manage(provider, "start")} disabled={!canConnect}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
                    {action?.id === provider.id && action.operation === "start" ? "Opening…" : manageable ? "Reconnect" : "Connect"}
                  </button>
                )}
              </div>
              {manageable && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  {ready && row.status === "connected" && <button type="button" className="min-h-11 px-2 text-sm underline"
                    disabled={!!action || recordStatus !== "ready"} onClick={() => manage(provider, "refresh")}>
                    {action?.id === provider.id && action.operation === "refresh" ? "Refreshing…" : "Refresh connection"}
                  </button>}
                  {confirm === provider.id ? <>
                    <p className="w-full text-sm">Remove iFund’s saved access to this account?</p>
                    <button type="button" className="min-h-11 px-2 text-sm font-semibold text-destructive"
                      disabled={!!action} onClick={() => manage(provider, "disconnect")}>
                      {action?.id === provider.id && action.operation === "disconnect" ? "Disconnecting…" : "Confirm disconnect"}
                    </button>
                    <button type="button" className="min-h-11 px-2 text-sm" disabled={!!action} onClick={() => setConfirm("")}>Cancel</button>
                  </> : <button type="button" className="min-h-11 px-2 text-sm underline"
                    disabled={!!action || recordStatus !== "ready"} onClick={() => setConfirm(provider.id)}>Disconnect</button>}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {rows.some(row => !PROVIDERS.some(provider => (ALIASES[provider.id] || [provider.id]).includes(row.provider))) && (
        <ul className="mt-6 space-y-2">
          {rows.filter(row => !PROVIDERS.some(provider => (ALIASES[provider.id] || [provider.id]).includes(row.provider)))
            .map(row => <li key={row.id}>{row.provider} · {getConnectionLabel(row)}</li>)}
        </ul>
      )}
    </main>
  );
}
