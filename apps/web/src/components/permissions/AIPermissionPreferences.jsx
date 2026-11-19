import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

const INITIAL = {
  default_action: "ask",
  allow_ai_campaign_drafts: false,
  allow_ai_outreach_drafts: false,
  allow_future_internal_ai_assistance: false,
  interested_in_future_automation: false,
};
const fields = Object.keys(INITIAL);
const choices = [
  ["allow_future_internal_ai_assistance", "Current and future private AI assistance", "Allow newly released private AI drafting, analysis, and recommendations automatically. Uncheck and Save to revoke. External access, publishing, messages, financial activity and permissions involving other people still require separate approval."],
  ["allow_ai_campaign_drafts", "AI campaign drafting", "Let iFund AI prepare suggestions for your review. Nothing is published automatically."],
  ["allow_ai_outreach_drafts", "AI outreach drafts", "Let iFund AI prepare promotional posts and messages for you to review. No automatic sending."],
  ["interested_in_future_automation", "Notify me when more automation becomes available", "This is an expression of interest, not consent to future tools or access to outside accounts."]
];
export default function AIPermissionPreferences() {
  const [values,setValues] = useState(INITIAL);
  const [phase,setPhase] = useState("loading");
  const [notice,setNotice] = useState("");
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPhase("loading");
    authClient().from("ifund_ai_permission_preferences").select(fields.join(",")).maybeSingle()
      .then(async ({data,error}) => {
        if (!active) return;
        if (error) throw error;
        if (data) {
          setValues(Object.fromEntries(fields.map(key => [key, key === "default_action" ? (["ask","draft","manual"].includes(data[key]) ? data[key] : "ask") : data[key] === true])));
        } else {
          // Preliminary signup choices are local interest only. Match the verified
          // account and require a deliberate Save; never activate or infer scopes.
          let proposed = INITIAL;
          try {
            const pending = JSON.parse(sessionStorage.getItem("ifund-signup-ai-interest-v1") || "null");
            const {data:authData} = await authClient().auth.getUser();
            const user = authData?.user;
            if (user?.email_confirmed_at && user.email?.toLowerCase() === pending?.email
              && Date.now() - pending.timestamp < 86400000 && Date.now() >= pending.timestamp) {
              proposed = {...INITIAL,...Object.fromEntries(choices.map(([key]) => [key,pending.choices?.[key] === true]))};
              setNotice("Your signup choices are ready to review. Select Save AI preferences to activate them for your account.");
            }
          } catch { /* Fail closed if browser storage is unavailable. */ }
          setValues(proposed);
        }
        setPhase("ready");
      })
      .catch(() => { if(active) setPhase("error"); });
    return () => { active = false; };
  },[retry]);
  async function save(event) {
    event.preventDefault();
    if(phase !== "ready") return;
    setPhase("saving");setNotice("");
    try {
      const {data:userData,error:userError} = await authClient().auth.getUser();
      if(userError || !userData?.user?.id || userData.user.is_anonymous || !userData.user.email_confirmed_at)
        throw new Error("Sign in to a verified account to save preferences.");
      const payload = {owner_id:userData.user.id,...values,updated_at:new Date().toISOString()};
      const {data,error} = await authClient().from("ifund_ai_permission_preferences").upsert(payload,{onConflict:"owner_id"}).select("owner_id").single();
      if(error || data?.owner_id !== userData.user.id) throw new Error("Preferences could not be verified as saved.");
      try { sessionStorage.removeItem("ifund-signup-ai-interest-v1"); } catch { /* preference was saved on server */ }
      setPhase("ready");setNotice("Your AI preferences were saved. No external platform access was granted.");
    } catch(error) { setPhase("ready");setNotice(error?.message || "Unable to save preferences."); }
  }
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-labelledby="ai-permission-heading">
    <h2 id="ai-permission-heading" className="text-xl font-semibold">iFund AI permissions</h2>
    <p className="text-sm text-muted-foreground">Private campaign, outreach and future internal AI drafting or analysis assistance is offered by default when you sign up, unless you decline the relevant checkboxes. To revoke it, uncheck the option here and select Save AI preferences. Saved changes take effect for new drafts and do not authorize third-party posting, account access, messages, payment activity, or future features. Those require separate, explicit approval.</p>
    {phase === "loading" && <p role="status">Loading saved AI preferences…</p>}
    {phase === "error" && <p role="alert">Could not read your saved preferences. <button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
    {(phase === "ready" || phase === "saving") && <form className="space-y-4" onSubmit={save}>
      <fieldset disabled={phase === "saving"} className="space-y-4">
        {choices.map(([key,title,detail]) => <label key={key} className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={values[key]} onChange={event=>setValues(current=>({...current,[key]:event.target.checked}))}/>
          <span><strong className="block">{title}</strong><span className="text-sm text-muted-foreground">{detail}</span></span>
        </label>)}
        <label className="block font-medium">Default handling of AI suggestions
          <select className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3" value={values.default_action} onChange={event=>setValues(current=>({...current,default_action:event.target.value}))}>
            <option value="ask">Ask me before taking any supported action</option>
            <option value="draft">Draft only, never publish</option>
            <option value="manual">Manual assistance only</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">{phase === "saving" ? "Saving…" : "Save AI preferences"}</button>
      </fieldset>
    </form>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </section>;
}
