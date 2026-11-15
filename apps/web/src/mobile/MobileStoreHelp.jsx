import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Flag, ShieldCheck, MessageSquareText } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";

const TOPICS = [
  ["Mobile app problem", "App or sign-in problem"],
  ["Privacy and data request", "Privacy and personal data"],
  ["Campaign safety or infringement", "Content safety or intellectual property"],
  ["Account access assistance", "Account access"],
];
export default function MobileStoreHelp() {
  const {user,status}=useAuthSession();
  const [topic,setTopic]=useState(TOPICS[0][0]);
  const [details,setDetails]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[reference,setReference]=useState("");

  async function sendSupport(event) {
    event.preventDefault();
    if(busy || reference)return;
    setError("");
    const message=details.trim();
    if(!TOPICS.some(([value])=>value===topic) || message.length<10 || message.length>4000){
      setError("Choose a topic and write 10 to 4000 characters.");return;
    }
    setBusy(true);
    try {
      const client=authClient();
      const {data,error:authError}=await client.auth.getUser();
      if(authError || !data?.user?.id || data.user.is_anonymous ||
          !data.user.email_confirmed_at || data.user.id!==user?.id)
        throw new Error("Sign in with a verified IFund email to create a tracked support request.");
      const {data:result,error:rpcError}=await client.rpc("ifund_create_support_ticket",{
        p_subject:topic,
        p_message:message,
      });
      if(rpcError || !Array.isArray(result) || typeof result[0]?.ticket_id!=="string")
        throw new Error(rpcError?.message||"The support request was not confirmed.");
      setReference(result[0].ticket_id);
      setDetails("");
    }catch(cause){setError(cause?.message||"Unable to confirm the request with IFund.");}
    finally{setBusy(false);}
  }

  return <div className="space-y-6">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Help and safety</h1>
      <p className="text-sm leading-6 text-slate-300">
        Contact Interplanetary Fund about a campaign, app problem, privacy concern or account request.
      </p>
    </header>
    <section className="space-y-4 rounded-2xl border border-white/20 bg-white/5 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <MessageSquareText aria-hidden="true" className="h-5 w-5 text-emerald-300"/>
        Contact our team securely
      </h2>
      <p className="text-sm text-slate-300">Signed-in members can submit a tracked request to the live IFund support queue. No payment, password or private authentication code is needed.</p>
      {status==="loading"&&<p role="status" className="text-sm">Checking your account…</p>}
      {status!=="loading"&&!user&&<div className="space-y-3 text-sm">
        <p>Sign in to send a tracked request, or use the public contact email below.</p>
        <Link to="/login?returnTo=%2Fhelp" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 font-semibold text-slate-950">Sign in to contact support</Link>
      </div>}
      {user&&!reference&&<form onSubmit={sendSupport} className="space-y-4">
        <label htmlFor="ifund-support-topic" className="block text-sm font-semibold">Reason for contacting us</label>
        <select id="ifund-support-topic" value={topic} onChange={event=>setTopic(event.target.value)}
          className="min-h-12 w-full rounded-xl border border-emerald-300/40 bg-[#10303c] px-3 py-2 text-sm text-white">
          {TOPICS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
        <label htmlFor="ifund-support-details" className="block text-sm font-semibold">Describe the problem</label>
        <textarea id="ifund-support-details" value={details} onChange={event=>setDetails(event.target.value)}
          className="min-h-36 w-full rounded-xl border border-emerald-300/40 bg-[#10303c] p-3 text-sm text-white"
          minLength={10} maxLength={4000} required
          placeholder="What happened, where, and what would help? Please do not include passwords, verification codes or card information." />
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-emerald-200 px-5 font-semibold text-slate-950 disabled:opacity-50">
          {busy?"Sending request…":"Send secure support request"}
        </button>
      </form>}
      {error&&<p role="alert" className="rounded-lg border border-rose-300/40 p-3 text-sm text-rose-200">{error}</p>}
      {reference&&<div role="status" className="space-y-2 rounded-lg border border-emerald-300/40 p-4">
        <h3 className="font-semibold">Support request recorded</h3>
        <p className="break-all text-sm">Reference: {reference}</p>
        <p className="text-xs text-slate-300">A request was recorded; resolution and response have not yet been verified.</p>
      </div>}
      <h3 className="flex items-center gap-2 text-sm font-bold"><Mail aria-hidden="true" className="h-5 w-5 text-emerald-300"/> Public contact email</h3>
      <a href="mailto:hello@interplanetaryfund.com" className="inline-flex min-h-12 items-center rounded-lg border border-emerald-300/40 px-4 text-sm text-emerald-200">hello@interplanetaryfund.com</a>
      <p className="text-xs text-slate-300">Do not email passwords, authentication codes, payment-card numbers or sensitive medical documents. Email delivery must be independently verified.</p>
    </section>
    <section className="space-y-3 rounded-2xl border border-white/20 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Flag aria-hidden="true" className="h-5 w-5 text-emerald-300"/> Report an unsafe campaign
      </h2>
      <p className="text-sm leading-6 text-slate-300">Open the campaign and choose <strong>Report content</strong>. Confirmed-member reports create a tracked case. You can hide the campaign or block its organizer.</p>
      <Link to="/discover" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 text-sm font-bold text-slate-950">Explore campaigns</Link>
    </section>
    <section className="space-y-3 rounded-2xl border border-white/20 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-300"/> Privacy and account deletion
      </h2>
      <div className="flex flex-wrap gap-4">
        <Link to="/delete-account" className="text-emerald-200 underline">Delete your account</Link>
        <Link to="/privacy" className="text-emerald-200 underline">Privacy policy</Link>
        <Link to="/terms" className="text-emerald-200 underline">Terms</Link>
      </div>
    </section>
  </div>;
}
