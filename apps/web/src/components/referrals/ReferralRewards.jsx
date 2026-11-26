import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Gift, CheckCircle2 } from "lucide-react";
import { authClient } from "@/api/auth";
import { validReferralCode } from "./ReferralTrialBootstrap";
import { trialAccessState } from "@/lib/referralTrial.mjs";

export default function ReferralRewards({ ownerId }) {
  const [info, setInfo] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [entry, setEntry] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const { data, error } = await authClient().rpc("ifund_agent_referral_status");
      if (error || !validReferralCode(data?.referral_code)) throw new Error("Unavailable");
      setInfo(data); setPhase("ready");
    } catch { setPhase("unavailable"); }
  }
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    authClient().rpc("ifund_agent_referral_status").then(({ data, error }) => {
      if (!active) return;
      if (error || !validReferralCode(data?.referral_code)) setPhase("unavailable");
      else { setInfo(data); setPhase("ready"); }
    }).catch(() => { if (active) setPhase("unavailable"); });
    return () => { active = false; };
  }, [ownerId]);
  const url = info?.referral_code ? "https://interplanetaryfund.com/register?ref=" + encodeURIComponent(info.referral_code) : "";
  const trialState = trialAccessState(info?.trial_enabled, info?.trial_expires_at);
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setNote("Referral link copied."); }
    catch { setNote("Copy the referral link from the field below."); }
  }
  async function applyCode(event) {
    event.preventDefault();
    if (!validReferralCode(entry) || busy) return;
    setBusy(true); setNote("");
    try {
      const { data, error } = await authClient().rpc("ifund_claim_campaign_referral", { p_code:entry.trim().toUpperCase() });
      if (error) throw error;
      setNote(data?.accepted === true
        ? "Referral recorded. The referring member earns 24 hours after you publish your first campaign."
        : data?.reason === "already_claimed" ? "A referral has already been recorded for this account."
        : data?.reason === "campaign_already_started" ? "Referral codes need to be used before creating your first campaign."
        : "That referral code is not eligible for this account.");
      if (data?.accepted === true) setEntry("");
      await refresh();
    } catch { setNote("Couldn't verify that referral code. No reward was applied."); }
    finally { setBusy(false); }
  }
  if (!ownerId) return null;
  return <section className="ifund-dashboard-card space-y-4" aria-labelledby="ifund-referral-heading">
    <div className="flex items-center gap-3">
      <span className="rounded-xl border border-cyan-400/30 p-3 text-cyan-600"><Gift size={23} aria-hidden="true"/></span>
      <div><h2 id="ifund-referral-heading" className="text-xl font-bold">Share IFund, earn more agent time</h2>
        <p className="text-sm text-muted-foreground">Each new member who uses your code and publishes their first campaign earns you another 24 hours of premium access.</p></div>
    </div>
    {phase === "loading" && <p role="status" className="text-sm">Checking your referral code…</p>}
    {phase === "unavailable" && <p role="status" className="text-sm text-muted-foreground">Referral codes aren't available on this deployment yet.</p>}
    {phase === "ready" && <div className="space-y-3">
      <p className="text-sm font-semibold">Your code: <span className="font-mono tracking-wider">{info.referral_code}</span></p>
      <div className="flex flex-wrap gap-2">
        <input type="text" aria-label="Your shareable referral link" readOnly value={url}
          onFocus={event => event.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"/>
        <button type="button" onClick={copyLink} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold">
          <Copy size={16} aria-hidden="true"/> Copy link
        </button>
      </div>
      <p className="text-sm"><CheckCircle2 className="mr-1 inline h-4 w-4 text-cyan-600" aria-hidden="true"/>
        {Number(info.successful_referrals || 0)} qualifying referrals · {Number(info.pending_hours || 0)} saved bonus hours
      </p>
      {trialState === "active"
        ? <p className="text-sm text-muted-foreground">Agent access through {new Date(info.trial_expires_at).toLocaleString()} (unless a verified paid plan grants longer access).</p>
        : trialState === "expired"
          ? <p className="text-sm text-muted-foreground">Agent trial access ended {new Date(info.trial_expires_at).toLocaleString()}. Refer members or choose a plan to continue.</p>
          : <p className="text-sm text-muted-foreground">The trial service isn't activated yet. Qualifying referral hours are saved for launch; no card is charged.</p>}
    </div>}
    <form onSubmit={applyCode} className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-sm font-semibold">Have a referral code?
        <input type="text" inputMode="text" autoCapitalize="characters" value={entry}
          onChange={event=>setEntry(event.target.value.toUpperCase().replace(/[^A-F0-9]/gu,"").slice(0,12))}
          maxLength={12} placeholder="12-character code"
          className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm"/>
      </label>
      <button type="submit" disabled={busy || !validReferralCode(entry) || phase!=="ready"}
        className="min-h-11 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {busy?"Checking…":"Apply code"}
      </button>
    </form>
    {note && <p role="status" className="text-sm">{note}</p>}
    <p className="text-sm"><Link to="/profile?tab=referrals" className="font-semibold text-primary underline">Manage referrals in My Profile</Link></p>
    <p className="text-xs text-muted-foreground">One code per new account. Self-referrals, repeat claims, unpublished drafts and fabricated campaigns do not qualify.</p>
  </section>;
}
