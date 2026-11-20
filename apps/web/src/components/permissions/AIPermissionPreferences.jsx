import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

// The product exposes one choice; the existing backend columns remain for compatibility
// with the separate campaign, outreach, and internal-agent authorization checks.
const AI_FIELDS = ["allow_ai_campaign_drafts", "allow_ai_outreach_drafts", "allow_future_internal_ai_assistance"];
const COLUMNS = ["owner_id", "default_action", ...AI_FIELDS].join(",");
export const aiEnabled = preferences => AI_FIELDS.some(field => preferences?.[field] === true);

export default function AIPermissionPreferences() {
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [phase, setPhase] = useState("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setPhase("loading");
    setError("");
    setMessage("");
    (async () => {
      const client = authClient();
      const { data: identity, error: identityError } = await client.auth.getUser();
      const user = identity?.user;
      if (identityError || !user?.id || user.is_anonymous || !user.email_confirmed_at)
        throw Error("Sign in with a verified account to manage AI.");
      const { data, error: readError } = await client.from("ifund_ai_permission_preferences")
        .select(COLUMNS).eq("owner_id", user.id).maybeSingle();
      if (readError || (data && data.owner_id !== user.id)) throw Error("Unable to load your saved AI setting.");
      if (!active) return;
      // No record: preserve opt-in interest from signup only as an unsaved proposal.
      let next = aiEnabled(data);
      if (!data) {
        try {
          const pending = JSON.parse(sessionStorage.getItem("ifund-signup-ai-interest-v1") || "null");
          if (pending?.email === user.email?.toLowerCase() &&
              Number.isFinite(pending.timestamp) && Date.now() >= pending.timestamp &&
              Date.now() - pending.timestamp < 86400000) {
            next = AI_FIELDS.some(field => pending.choices?.[field] === true);
            setMessage("Review this choice from sign-up, then save it to your account.");
          }
        } catch { /* Storage is optional. */ }
      }
      setSaved(aiEnabled(data));
      setEnabled(next);
      setPhase("ready");
    })().catch(cause => {
      if (active) { setError(cause?.message || "Unable to load your AI setting."); setPhase("error"); }
    });
    return () => { active = false; };
  }, [retry]);

  async function save(event) {
    event.preventDefault();
    if (phase !== "ready") return;
    setPhase("saving");
    setMessage("");
    setError("");
    try {
      const client = authClient();
      const {data: identity, error: identityError} = await client.auth.getUser();
      const user = identity?.user;
      if (identityError || !user?.id || user.is_anonymous || !user.email_confirmed_at)
        throw Error("Sign in with a verified account to save this setting.");
      const payload = {
        owner_id: user.id,
        // Save ALL legacy authorization flags as a single setting. A disabled AI
        // switch must not leave an older narrower AI consent enabled behind it.
        ...Object.fromEntries(AI_FIELDS.map(field => [field, enabled])),
        default_action: enabled ? "ask" : "manual",
        updated_at: new Date().toISOString(),
      };
      const result = await client.from("ifund_ai_permission_preferences")
        .upsert(payload, {onConflict: "owner_id"}).select(COLUMNS).single();
      if (result.error || result.data?.owner_id !== user.id ||
          AI_FIELDS.some(field => result.data[field] !== enabled))
        throw Error("Your AI setting could not be confirmed.");
      const check = await client.from("ifund_ai_permission_preferences")
        .select(COLUMNS).eq("owner_id", user.id).maybeSingle();
      const currentUser = await client.auth.getUser();
      if (check.error || check.data?.owner_id !== user.id ||
          currentUser.error || currentUser.data?.user?.id !== user.id ||
          AI_FIELDS.some(field => check.data[field] !== enabled))
        throw Error("Unable to verify the saved setting. Reload before trying again.");
      setSaved(enabled);
      try { sessionStorage.removeItem("ifund-signup-ai-interest-v1"); } catch { /* Optional */ }
      setMessage(enabled ? "AI assistance is on for your account." : "AI assistance is off for your account.");
    } catch (cause) {
      setError(cause?.message || "Could not save your setting.");
    } finally {
      setPhase("ready");
    }
  }

  const dirty = phase === "ready" && enabled !== saved;
  return <section className="space-y-5 rounded-3xl border border-cyan-500/25 bg-card p-5 sm:p-7" aria-labelledby="ai-permission-heading">
    <header className="space-y-2">
      <h2 id="ai-permission-heading" className="text-2xl font-semibold">AI Assistance</h2>
      <p className="text-sm text-muted-foreground">Choose whether iFund AI can help you with your campaigns, ideas, and planning.</p>
    </header>
    {phase === "loading" && <p role="status">Loading your AI setting…</p>}
    {phase === "error" && <p role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>Try again</button></p>}
    {(phase === "ready" || phase === "saving") && <form onSubmit={save} className="space-y-5">
      <label className="flex min-h-28 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-background/70 p-4 transition hover:border-cyan-400/60 sm:p-5">
        <span className="space-y-1">
          <strong className="block text-lg">Let iFund AI help me</strong>
          <span className="block text-sm text-muted-foreground">{enabled ? "AI help is on" : "AI help is off"}</span>
        </span>
        <span className="relative flex shrink-0 items-center">
          <input type="checkbox" role="switch" aria-label="AI Assistance" disabled={phase === "saving"}
            checked={enabled} onChange={event => {setEnabled(event.target.checked); setMessage("");setError("");}}
            className="peer sr-only"/>
          <span aria-hidden="true" className="relative h-9 w-16 rounded-full border-2 border-border bg-muted transition-colors peer-checked:border-cyan-500 peer-checked:bg-cyan-500 peer-focus-visible:outline peer-focus-visible:outline-4 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-cyan-400 peer-disabled:opacity-50">
            <span className={"absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform " + (enabled ? "translate-x-7" : "")}/>
          </span>
        </span>
      </label>
      <details className="rounded-xl border border-border p-4 text-sm">
        <summary className="cursor-pointer font-medium">What does this include?</summary>
        <p className="mt-3 text-muted-foreground">When on, iFund AI can help write and improve campaigns, prepare outreach drafts, answer questions, and suggest ideas. Some tools may need a qualifying plan.</p>
        <p className="mt-2 text-muted-foreground">It does not automatically post to other websites, send messages, access connected accounts, spend money, or withdraw funds. Those activities require their own permissions and confirmation.</p>
        <p className="mt-2 text-muted-foreground">Turn it off whenever you choose. This does not remove content you already saved or disconnect outside accounts.</p>
      </details>
      {dirty && <p className="text-sm text-amber-600 dark:text-amber-300">Change not saved yet.</p>}
      <button type="submit" disabled={phase === "saving"} className="min-h-12 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60">{phase === "saving" ? "Saving…" : "Save AI setting"}</button>
      {message && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>}
  </section>;
}
