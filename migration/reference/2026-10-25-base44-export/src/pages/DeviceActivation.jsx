import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ShieldX, KeyRound, Loader2 } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

const LABELS = {
  "identity:read": "View your IFund screen name and display name",
  "campaigns:read": "View your campaign names and public fundraising progress",
};
const normalize = (code) => String(code || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 10);
const displayCode = (raw) => raw.length > 5 ? raw.slice(0,5) + "-" + raw.slice(5) : raw;

export default function DeviceActivation() {
  const param = new URLSearchParams(window.location.search).get("code");
  const [code, setCode] = useState(displayCode(normalize(param)));
  const [identity, setIdentity] = useState({state:"loading", user:null});
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let active = true;
    base44.auth.me().then(user => {
      if (active) setIdentity(user ? {state:"signed-in",user} : {state:"signed-out",user:null});
    }).catch(() => { if (active) setIdentity({state:"signed-out",user:null}); });
    return () => { active=false; };
  }, []);

  const check = async () => {
    setError(""); setInfo(null); setDone("");
    const userCode = normalize(code);
    if (userCode.length !== 10) { setError("Enter all 10 characters shown on the device."); return; }
    setBusy("checking");
    try {
      const response = await base44.functions.invoke("deviceAuthorization",{mode:"inspect",user_code:userCode});
      const data = response?.data || response;
      if (data?.ok !== true || !Array.isArray(data.scopes)) throw Error("Invalid authorization response");
      setInfo({...data,user_code:userCode});
    } catch {
      setError("This code could not be verified. It may have expired or already been used.");
    } finally { setBusy(""); }
  };

  const decide = async (decision) => {
    if (!info || busy) return;
    setError("");setBusy(decision);
    try {
      const response = await base44.functions.invoke("deviceAuthorization",{
        mode:"decide",user_code:info.user_code,decision,
      });
      const data = response?.data || response;
      if (data.ok !== true || data.decision !== decision) throw Error("Decision was not saved");
      setInfo(null);
      setDone(decision === "approve"
        ? "Device approved. You can return to the device while it completes the connection."
        : "Request denied. This device has not been granted access.");
    } catch {
      setError("Authorization was not completed. Please retry from the device with a fresh code.");
      setInfo(null);
    } finally { setBusy(""); }
  };

  const loginTarget = "/login?returnTo=" +
    encodeURIComponent("/activate" + (normalize(code) ? "?code=" + encodeURIComponent(displayCode(normalize(code))) : ""));
  return (
    <main className="ifund-auth min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-lg">
        <div className="mb-7 flex justify-center"><BrandLogo size="md" /></div>
        <section className="ifund-auth-card rounded-3xl border border-cyan-300/20 bg-slate-900 p-5 sm:p-7 shadow-xl">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <KeyRound className="w-6 h-6 text-cyan-300" /> Authorize a device
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Enter the temporary code shown on a device or IFund agent. Review what it can access before approving.
          </p>
          {identity.state === "loading" ? (
            <p className="mt-6 flex items-center gap-2 text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Checking your account…</p>
          ) : identity.state === "signed-out" ? (
            <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
              Sign in to your own IFund account to decide whether to connect a device.
              <Link to={loginTarget} className="mt-3 block rounded-xl bg-cyan-400 px-4 py-3 text-center font-semibold text-slate-950">
                Sign in and continue
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-5 text-xs text-cyan-200">Signed in as {identity.user?.username || identity.user?.full_name || "IFund member"}</p>
              {!done && (
                <form onSubmit={event => { event.preventDefault(); void check(); }} className="mt-4 space-y-3">
                  <label htmlFor="ifund-device-code" className="block text-sm font-semibold">Device verification code</label>
                  <Input id="ifund-device-code" autoComplete="one-time-code" autoCapitalize="characters"
                    value={code} onChange={event => {setCode(displayCode(normalize(event.target.value))); setInfo(null);setError("");}}
                    placeholder="ABCDE-23456" maxLength={11}
                    className="h-12 border-slate-600 bg-slate-950 text-lg tracking-widest text-white" />
                  <Button type="submit" disabled={!!busy || normalize(code).length !== 10} className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                    {busy === "checking" ? "Checking…" : "Review request"}
                  </Button>
                </form>
              )}
              {info && (
                <div className="mt-5 rounded-xl border border-violet-400/40 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-violet-200">Device requesting access</p>
                  <p className="mt-1 font-semibold">{info.device_label}</p>
                  <p className="mt-1 text-xs text-slate-400">Device name supplied by the requester; it is not independently verified.</p>
                  <p className="mt-4 text-sm font-semibold">Permissions requested</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-200">
                    {info.scopes.map(scope => <li key={scope}>• {LABELS[scope] || "Unknown permission — do not approve"}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-slate-400">
                    This does not authorize donations, payments, withdrawals, publishing, or access to external accounts.
                    You can revoke access anytime from your profile.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" disabled={!!busy} onClick={() => decide("deny")}
                      className="border-rose-300/40 text-rose-200 hover:bg-rose-500/20">
                      <ShieldX className="mr-1 h-4 w-4" /> Deny
                    </Button>
                    <Button type="button" disabled={!!busy || info.scopes.some(scope => !LABELS[scope])}
                      onClick={() => decide("approve")} className="bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300">
                      <ShieldCheck className="mr-1 h-4 w-4" /> Approve
                    </Button>
                  </div>
                </div>
              )}
              {done && <p role="status" className="mt-5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm">{done}</p>}
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
