import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound, ShieldCheck, ShieldX, LoaderCircle } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { authClient } from "@/api/auth";

const LABELS = {
  "identity:read": "View your IFund handle and display name",
  "campaigns:read": "View names and public details of active campaigns",
};
const normalize = (value) => String(value || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 10);
const displayCode = (value) => value.length > 5 ? value.slice(0, 5) + "-" + value.slice(5) : value;

async function deviceRequest(mode, body) {
  const client = authClient();
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error("Sign in to approve a device.");
  const response = await fetch("/api/device-authorization/" + mode, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + session.access_token,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Device authorization is unavailable.");
  return data;
}

export default function DeviceActivation() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(displayCode(normalize(params.get("code"))));
  const [identity, setIdentity] = useState("loading");
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error: authError } = await authClient().auth.getUser();
        if (active) setIdentity(!authError && data?.user ? "signed-in" : "signed-out");
      } catch {
        if (active) setIdentity("signed-out");
      }
    })();
    return () => { active = false; };
  }, []);

  async function inspect(event) {
    event.preventDefault();
    if (busy) return;
    const user_code = normalize(code);
    setError("");
    setDone("");
    setInfo(null);
    if (user_code.length !== 10) {
      setError("Enter all 10 characters shown on the device.");
      return;
    }
    setBusy("inspect");
    try {
      const data = await deviceRequest("inspect", { user_code });
      if (data.ok !== true || !Array.isArray(data.scopes)) throw new Error("Invalid authorization response.");
      setInfo({ ...data, user_code });
    } catch (cause) {
      setError(cause?.message || "This code could not be verified. It may have expired or already been used.");
    } finally {
      setBusy("");
    }
  }

  async function decide(decision) {
    if (!info || busy) return;
    setBusy(decision);
    setError("");
    setDone("");
    try {
      const data = await deviceRequest("decide", { user_code: info.user_code, decision });
      if (data.ok !== true || data.decision !== decision) throw new Error("Decision was not saved.");
      setInfo(null);
      setDone(decision === "approve"
        ? "Device approved. Return to it to complete the limited read-only connection."
        : "Request denied. This device has not been granted access.");
    } catch (cause) {
      setError(cause?.message || "Authorization was not completed. Please retry with a fresh code.");
      setInfo(null);
    } finally {
      setBusy("");
    }
  }

  const returnTo = "/activate" + (normalize(code) ? "?code=" + encodeURIComponent(displayCode(normalize(code))) : "");
  return (
    <main className="ifund-auth min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-lg">
        <div className="mb-7 flex justify-center"><BrandLogo size="md" /></div>
        <section className="ifund-auth-card rounded-3xl border border-cyan-300/20 bg-slate-900 p-5 shadow-xl sm:p-7">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <KeyRound className="h-6 w-6 text-cyan-300" /> Authorize a device
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Enter the temporary code shown on a device or IFund agent. Review the requested permissions before approving.
          </p>
          {identity === "loading" && <p role="status" className="mt-6 flex items-center gap-2 text-slate-300"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking your account…</p>}
          {identity === "signed-out" && (
            <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
              Sign in to your own IFund account to decide whether to connect a device.
              <Link to={"/login?returnTo=" + encodeURIComponent(returnTo)} className="mt-3 block rounded-xl bg-cyan-400 px-4 py-3 text-center font-semibold text-slate-950">
                Sign in and continue
              </Link>
            </div>
          )}
          {identity === "signed-in" && (
            <>
              <form onSubmit={inspect} className="mt-5 space-y-3">
                <label htmlFor="ifund-device-code" className="block text-sm font-semibold">Device verification code</label>
                <input id="ifund-device-code" autoComplete="one-time-code" autoCapitalize="characters"
                  value={code} onChange={event => { setCode(displayCode(normalize(event.target.value))); setInfo(null); setError(""); setDone(""); }}
                  placeholder="ABCDE-23456" maxLength={11}
                  className="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 text-lg tracking-widest text-white" />
                <button type="submit" disabled={!!busy || normalize(code).length !== 10}
                  className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">
                  {busy === "inspect" ? "Checking…" : "Review request"}
                </button>
              </form>
              {info && (
                <div className="mt-5 rounded-xl border border-violet-400/40 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-violet-200">Device requesting access</p>
                  <p className="mt-1 font-semibold">{info.device_label}</p>
                  <p className="mt-1 text-xs text-slate-400">The device name is supplied by the requester and is not independently verified.</p>
                  <p className="mt-4 text-sm font-semibold">Permissions requested</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {info.scopes.map(scope => <li key={scope}>{LABELS[scope] || "Unknown permission — do not approve"}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-slate-400">Device access does not authorize donations, payments, withdrawals, publishing, administration, or access to external accounts.</p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button type="button" disabled={!!busy} onClick={() => decide("deny")}
                      className="flex min-h-11 items-center justify-center rounded-xl border border-rose-300/40 px-3 text-rose-200 hover:bg-rose-500/20 disabled:opacity-50">
                      <ShieldX className="mr-1 h-4 w-4" /> Deny
                    </button>
                    <button type="button" disabled={!!busy || info.scopes.some(scope => !LABELS[scope])}
                      onClick={() => decide("approve")}
                      className="flex min-h-11 items-center justify-center rounded-xl bg-cyan-400 px-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">
                      <ShieldCheck className="mr-1 h-4 w-4" /> Approve
                    </button>
                  </div>
                </div>
              )}
              {done && <p role="status" className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm">{done}</p>}
              {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            </>
          )}
        </section>
        <div className="mt-5 text-center text-sm text-slate-300">
          <Link to="/devices" className="underline">Manage connected devices</Link>
          <span className="mx-2">·</span>
          <Link to="/" className="underline">Return to IFund</Link>
        </div>
      </div>
    </main>
  );
}
