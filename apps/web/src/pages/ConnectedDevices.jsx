import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ShieldOff, Smartphone } from "lucide-react";
import { authClient } from "@/api/auth";

async function deviceRequest(mode, method = "GET", body) {
  const client = authClient();
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error("Sign in to manage connected devices.");
  const response = await fetch("/api/device-authorization/" + mode, {
    method,
    cache: "no-store",
    headers: {
      authorization: "Bearer " + session.access_token,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Device service is unavailable.");
  return data;
}

const SCOPE_LABELS = {
  "identity:read": "IFund identity",
  "campaigns:read": "Campaign names and public progress",
};

export default function ConnectedDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await deviceRequest("devices");
      if (!Array.isArray(rows)) throw new Error("Invalid device list.");
      setDevices(rows);
    } catch (cause) {
      setError(cause?.message || "Could not load connected devices. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function revoke(id) {
    if (busy) return;
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const result = await deviceRequest("revoke", "POST", { id });
      if (result.revoked !== true) throw new Error("Revocation could not be verified.");
      setDevices(rows => rows.map(row => row.id === id ? { ...row, state: "revoked" } : row));
      setNotice("Device access revoked.");
    } catch (cause) {
      setError(cause?.message || "Could not revoke access. Please retry.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <h1 className="flex items-center gap-2 text-3xl font-bold">
        <Smartphone className="h-7 w-7 text-cyan-500" /> Connected devices
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Review devices and agents approved with a temporary code. These limited grants do not include payments, withdrawals, publishing, administrator actions, or external accounts.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/activate" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
          Enter a device code
        </Link>
        <button type="button" onClick={reload} disabled={loading}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold disabled:opacity-50">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">{notice}</p>}
      {loading ? <p role="status" className="mt-6 text-muted-foreground">Loading your devices…</p> :
        devices.length === 0 ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-5 text-muted-foreground">No authorized devices yet.</p>
        ) : (
          <div className="mt-6 space-y-3">
            {devices.map(device => {
              const expired = !device.grant_expires_at || Date.parse(device.grant_expires_at) <= Date.now();
              const active = device.state === "approved" && !expired;
              return (
                <section key={device.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{device.device_label}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {active ? "Authorized" : device.state === "revoked" ? "Revoked" : expired ? "Expired" : device.state}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {(device.scopes || []).map(scope => SCOPE_LABELS[scope] || "Unknown permission").join(" · ")}
                      </p>
                      {device.grant_expires_at && <p className="mt-2 text-xs text-muted-foreground">Expires {new Date(device.grant_expires_at).toLocaleDateString()}</p>}
                    </div>
                    {active && (
                      <button type="button" disabled={!!busy} onClick={() => revoke(device.id)}
                        className="inline-flex min-h-10 items-center rounded-xl border border-destructive/40 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                        <ShieldOff className="mr-2 h-4 w-4" /> {busy === device.id ? "Revoking…" : "Revoke access"}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
    </main>
  );
}
