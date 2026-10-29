import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

const STAGES = ["Welcome", "Profile", "Explore", "Connections", "Preferences", "Finish"];
const OPTIONS = [
  ["create", "Create and manage a campaign"],
  ["support", "Find causes to support"],
  ["community", "Participate in the community"],
  ["writing", "Write stories and blog posts"],
  ["organizations", "Connect with organizations"],
];
const PROVIDERS = ["Facebook", "Instagram", "LinkedIn", "YouTube", "PayPal", "Other"];
const EMPTY = {
  name: "", goal: "", activities: [], platforms: [],
  automated_suggestions: false, email_updates: false,
};
export default function Onboarding({ user }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saving = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!db || !user?.id) { setLoading(false); return; }
    db.from("ifund_profiles").select("display_name,onboarding,onboarding_completed")
      .eq("id", user.id).maybeSingle().then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(loadError.message);
        else if (data) {
          setForm({
            ...EMPTY, ...data.onboarding,
            name: data.onboarding?.name || data.display_name || "",
            activities: Array.isArray(data.onboarding?.activities) ? data.onboarding.activities : [],
            platforms: Array.isArray(data.onboarding?.platforms) ? data.onboarding.platforms : [],
          });
          if (data.onboarding_completed) setNotice("Your previous setup preferences were loaded.");
        }
        setLoading(false);
      }).catch((cause) => {
        if (cancelled) return;
        setLoading(false); setError(cause?.message || "Could not load setup preferences.");
      });
    return () => { cancelled = true; };
  }, [user?.id]);
  function toggle(key, value) {
    setForm((current) => {
      const list = current[key] || [];
      return { ...current, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  }
  async function finish() {
    if (!db || !user?.id || saving.current) return;
    saving.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const data = {
        id: user.id,
        display_name: form.name.trim().slice(0, 100),
        onboarding: {
          name: form.name.trim().slice(0, 100),
          goal: form.goal.trim().slice(0, 600),
          activities: form.activities,
          platforms: form.platforms,
          automated_suggestions: form.automated_suggestions,
          email_updates: form.email_updates,
        },
        onboarding_completed: true,
      };
      const { data: result, error: saveError } = await db.from("ifund_profiles")
        .upsert(data, { onConflict: "id" }).select("id").single();
      if (saveError || !result?.id) throw new Error(saveError?.message || "Setup could not be verified.");
      navigate("/dashboard", { replace: true });
    } catch (cause) {
      setError(cause?.message || "Could not save setup.");
    } finally { saving.current = false; setBusy(false); }
  }
  if (!user) return <main><h1>Set up IFund</h1>
    <p>Sign in to save your preferences.</p>
    <Link className="primary" to="/login?returnTo=%2Fonboarding">Sign in</Link></main>;
  if (loading) return <main className="onboard"><Loading /></main>;
  return <main className="onboard">
    <h1>Make IFund yours</h1>
    <p>Set up your profile and choose what you want to do. You can change your preferences later.</p>
    <ol className="quest-steps" aria-label={"Account setup step " + (current + 1) + " of 6"}>
      {STAGES.map((label, i) => <li key={label} className={i === current ? "current" : i < current ? "complete" : ""}>
        <span className="quest-step-icon">{i < current ? "✓" : i + 1}</span><span>{label}</span></li>)}
    </ol>
    <section className="quest-panel">
      {current === 0 && <div><h2>Welcome to Interplanetary Fund</h2>
        <p>Explore endless possibilities, build campaigns, connect with your community, and work on your own terms.</p>
        <p>Anything you select here is a preference. No external connections, automated posts, paid features or delegated permissions are activated by this setup.</p></div>}
      {current === 1 && <div className="form"><h2>Who are you?</h2>
        <label>Display name<input value={form.name} maxLength={100}
          onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></label>
        <label>What would you like to accomplish?
          <textarea rows={3} maxLength={600} value={form.goal}
            onChange={(e) => setForm((v) => ({ ...v, goal: e.target.value }))} /></label></div>}
      {current === 2 && <div><h2>What are you here to do?</h2>
        <div className="onboarding-checks">{OPTIONS.map(([id, label]) =>
          <label key={id}><input type="checkbox" checked={form.activities.includes(id)}
            onChange={() => toggle("activities", id)} />{label}</label>)}</div></div>}
      {current === 3 && <div><h2>Which platforms matter to you?</h2>
        <p>Select services you may choose to connect later. This does not sign in, grant access, or initiate synchronization.</p>
        <div className="onboarding-checks">{PROVIDERS.map((provider) =>
          <label key={provider}><input type="checkbox" checked={form.platforms.includes(provider)}
            onChange={() => toggle("platforms", provider)} />{provider}</label>)}</div>
        <Link to="/connections">View Connections Center</Link></div>}
      {current === 4 && <div><h2>Customize your experience</h2>
        <div className="onboarding-checks">
          <label><input type="checkbox" checked={form.automated_suggestions}
            onChange={(e) => setForm((v) => ({ ...v, automated_suggestions: e.target.checked }))} />
            I would like to see campaign improvement suggestions when available</label>
          <label><input type="checkbox" checked={form.email_updates}
            onChange={(e) => setForm((v) => ({ ...v, email_updates: e.target.checked }))} />
            I am interested in future IFund email updates</label>
        </div>
        <p>Preference selection is not consent to external posting, data imports or email marketing. Those actions require their own verified authorization.</p></div>}
      {current === 5 && <div><h2>Ready for your next chapter</h2>
        <p>Your settings will be stored privately with your IFund account.</p>
        <p>After setup, visit the dashboard to manage campaigns, write stories, and explore the community.</p>
        <p>Connected accounts, AI tools and outbound actions remain off until the independent services are verified.</p></div>}
    </section>
    <Message error={Boolean(error)}>{error || notice}</Message>
    <div className="quest-nav">
      <button type="button" className="secondary" disabled={busy || current === 0}
        onClick={() => setCurrent((n) => n - 1)}>← Back</button>
      <div className="actions">
        <Link to="/dashboard" className="secondary">Skip for now</Link>
        {current === 5 ? <button type="button" className="primary" disabled={busy}
          onClick={finish}>{busy ? "Saving…" : "Finish setup"}</button> :
          <button type="button" className="primary" disabled={busy}
            onClick={() => setCurrent((n) => n + 1)}>Continue →</button>}
      </div>
    </div>
  </main>;
}
