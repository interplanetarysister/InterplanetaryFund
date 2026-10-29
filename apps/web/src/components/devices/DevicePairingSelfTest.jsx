import { useEffect, useRef, useState } from "react";
import { KeyRound, LoaderCircle, Copy, ShieldCheck, ShieldAlert } from "lucide-react";
import { authClient } from "@/api/auth";

const GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const STATUS = {
  idle: "Run a read-only connection check for this browser and IFund account.",
  waiting: "Waiting for approval. Open the approval page, review the permissions, and approve the temporary code.",
  checking: "Checking the approved device grant…",
  verified: "The identity read succeeded and the temporary test grant was revoked.",
  cleanup: "The identity check finished, but automatic revocation could not be confirmed. Revoke the test grant below.",
  denied: "The request was denied. No device access was granted.",
  expired: "The temporary code expired. Start a new test.",
  failed: "The connection check could not finish. Review the service status and try again.",
};

async function api(mode, { body, token, deviceToken, method = "POST" } = {}) {
  const response = await fetch("/api/device-authorization/" + mode, {
    method, cache: "no-store",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(deviceToken ? { "x-ifund-device-token": deviceToken } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (Array.isArray(data)) return { ok: response.ok, status: response.status, data };
  return { ok: response.ok, status: response.status, ...data };
}

function randomLabel() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
  return "IFund browser check " + suffix;
}

export default function DevicePairingSelfTest({ onChanged }) {
  const deviceCode = useRef("");
  const active = useRef(false);
  const [test, setTest] = useState(null);
  const [status, setStatus] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    active.current = false;
    deviceCode.current = "";
  }, []);

  async function begin() {
    if (busy || status === "waiting" || status === "checking") return;
    setBusy(true);
    setError("");
    setTest(null);
    deviceCode.current = "";
    try {
      const label = randomLabel();
      const result = await api("request", {
        body: { client_id: "ifund-device-v1", device_label: label, scopes: ["identity:read"] },
      });
      if (!result.ok || !result.device_code || !result.user_code || !result.verification_uri_complete) {
        throw new Error(result.error || "The service did not issue a temporary code.");
      }
      deviceCode.current = result.device_code;
      active.current = true;
      setTest({
        label, userCode: result.user_code, url: result.verification_uri_complete,
        expiresAt: Date.now() + Math.min(600, Number(result.expires_in) || 600) * 1000,
      });
      setStatus("waiting");
    } catch (cause) {
      setError(cause?.message || "IFund could not issue a temporary device code.");
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!test) return;
    let timer;
    let stopped = false;
    const stop = () => { stopped = true; clearTimeout(timer); };
    const poll = async () => {
      if (stopped || !active.current) return;
      if (Date.now() >= test.expiresAt) {
        deviceCode.current = "";
        setStatus("expired");
        return;
      }
      try {
        const result = await api("token", {
          body: { grant_type: GRANT, device_code: deviceCode.current },
        });
        if (stopped) return;
        if (result.access_token && result.token_type === "Bearer") {
          setStatus("checking");
          let verified = false;
          let revoked = false;
          try {
            const resource = await api("resource", {
              body: { action: "identity" }, deviceToken: result.access_token,
            });
            verified = resource.ok === true && resource.identity?.id;
          } finally {
            // Keep the bearer only in this function's scope and clear the
            // device code immediately after the one authorized read.
            deviceCode.current = "";
          }
          if (verified) {
            try {
              const client = authClient();
              const { data: { session }, error: sessionError } = await client.auth.getSession();
              if (sessionError || !session?.access_token) throw new Error("Owner session unavailable");
              const rows = await api("devices", { method: "GET", token: session.access_token });
              if (!rows.ok || !Array.isArray(rows.data)) throw new Error("Device list unavailable");
              const matches = rows.data.filter(row => row.device_label === test.label && row.state === "approved");
              if (matches.length !== 1) throw new Error("Cannot identify unique test grant");
              const result = await api("revoke", {
                body: { id: matches[0].id }, token: session.access_token,
              });
              revoked = result.ok && result.revoked === true;
            } catch {
              revoked = false;
            }
          }
          active.current = false;
          if (!stopped) {
            setStatus(verified && revoked ? "verified" : "cleanup");
            if (!verified) setError("The read-only identity check failed. Review the device list before retrying.");
            onChanged?.();
          }
          return;
        }
        if (result.error === "authorization_pending" || result.error === "slow_down") {
          timer = setTimeout(poll, result.error === "slow_down" ? 10000 : 5000);
          return;
        }
        deviceCode.current = "";
        active.current = false;
        setStatus(result.error === "access_denied" ? "denied" :
          result.error === "expired_token" ? "expired" : "failed");
        if (result.error !== "access_denied" && result.error !== "expired_token")
          setError(result.error || "Authorization status could not be checked.");
      } catch (cause) {
        if (stopped) return;
        deviceCode.current = "";
        active.current = false;
        setStatus("failed");
        setError(cause?.message || "Could not contact the device authorization service.");
      }
    };
    timer = setTimeout(poll, 5000);
    return stop;
  }, [test, onChanged]);

  const activeTest = status === "waiting" || status === "checking";
  return (
    <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-slate-950/40 p-4 sm:p-5" aria-label="Device authorization connection test">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound className="h-5 w-5 text-cyan-400" /> Test device authorization
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Verify a limited read-only device connection using your account. The test requests identity access only and attempts to revoke its temporary grant automatically.
      </p>
      {!activeTest && (
        <button type="button" onClick={begin} disabled={busy}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          {busy ? "Creating test code…" : "Start connection test"}
        </button>
      )}
      {test && activeTest && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Temporary approval code</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <strong className="font-mono text-xl tracking-wider">{test.userCode}</strong>
            <button type="button" onClick={() => navigator.clipboard?.writeText(test.userCode).catch(() => {})}
              className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-sm">
              <Copy className="mr-1 h-4 w-4" /> Copy
            </button>
          </div>
          <a href={test.url} target="_blank" rel="noopener noreferrer"
            className="mt-4 block rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground">
            Open approval page
          </a>
        </div>
      )}
      <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        {status === "checking" && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {status === "verified" && <ShieldCheck className="h-4 w-4 text-emerald-400" />}
        {status === "cleanup" && <ShieldAlert className="h-4 w-4 text-amber-400" />}
        {STATUS[status]}
      </p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
    </section>
  );
}
