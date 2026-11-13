import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadMyProfile, saveMyProfile } from "@/lib/memberProfile";

const fieldClass = "mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2 font-semibold";

/**
 * A real member onboarding path using the same owner-scoped profile RPCs as
 * /profile. Provider connections, marketing authorization and campaign posting
 * are deliberately separate affirmative actions, not implied consent.
 */
export default function MemberOnboarding() {
  const [phase, setPhase] = useState("loading");
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setPhase("loading"); setError(""); setSaved(false);
    loadMyProfile().then(data => {
      if (!live) return;
      setProfile({
        ...data,
        display_name: data.display_name || "",
        handle: data.handle || "",
        bio: data.bio || "",
        public_profile_enabled: data.public_profile_enabled === true,
        show_posts: data.show_posts === true,
        featured_campaign_ids: Array.isArray(data.featured_campaign_ids) ? data.featured_campaign_ids : [],
      });
      setPhase("ready");
    }).catch(cause => {
      if (live) { setError(cause?.message || "Your profile could not be loaded."); setPhase("error"); }
    });
    return () => { live = false; };
  }, [revision]);

  function change(field, value) {
    setProfile(current => ({ ...current, [field]: value }));
    setSaved(false);
  }
  async function save(event) {
    event.preventDefault();
    if (phase !== "ready" || !profile) return;
    const name = profile.display_name.trim();
    const handle = profile.handle.trim();
    if (profile.public_profile_enabled && !name) {
      setError("Add a display name before making your profile public."); return;
    }
    if (handle && !/^[A-Za-z0-9_-]{3,32}$/.test(handle)) {
      setError("Use 3–32 letters, numbers, underscores, or hyphens for your handle."); return;
    }
    setPhase("saving"); setError(""); setSaved(false);
    try {
      const updated = await saveMyProfile({
        ...profile, display_name: name, handle, bio: profile.bio.trim(),
      });
      setProfile(current => ({ ...current, ...updated }));
      setSaved(true); setPhase("ready");
    } catch (cause) {
      setError(cause?.message || "Profile changes were not saved.");
      setPhase("ready");
    }
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-9 text-foreground sm:px-8">
    <header className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-500">Welcome to Interplanetary Fund</p>
      <h1 className="text-3xl font-bold">Set up your fundraising workspace</h1>
      <p className="text-sm text-muted-foreground">Choose what to share, then create a campaign or connect an outside account when you are ready. Nothing is published or connected automatically.</p>
    </header>
    {phase === "loading" && <p role="status">Loading your private profile…</p>}
    {phase === "error" && <section className="space-y-3 rounded-xl border border-destructive/40 p-5" role="alert">
      <p>{error}</p>
      <button type="button" className={buttonClass} onClick={() => setRevision(n => n + 1)}>Retry loading</button>
    </section>}
    {profile && (phase === "ready" || phase === "saving") && <>
      <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">1. Your profile</h2>
        <p className="text-sm text-muted-foreground">Your changes are saved only to your verified account after you select Save.</p>
        <fieldset disabled={phase === "saving"} className="space-y-4 disabled:opacity-60">
          <label className="block text-sm font-medium">Display name
            <input className={fieldClass} value={profile.display_name} onChange={event => change("display_name", event.target.value)} maxLength={100} required={profile.public_profile_enabled} autoComplete="nickname" />
          </label>
          <label className="block text-sm font-medium">Handle (optional)
            <input className={fieldClass} value={profile.handle} onChange={event => change("handle", event.target.value)} maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" aria-describedby="onboarding-handle-help" />
            <span id="onboarding-handle-help" className="block pt-1 text-xs text-muted-foreground">3–32 letters, numbers, underscores or hyphens.</span>
          </label>
          <label className="block text-sm font-medium">About you (optional)
            <textarea className={fieldClass} rows={3} maxLength={900} value={profile.bio} onChange={event => change("bio", event.target.value)} />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={profile.public_profile_enabled} onChange={event => change("public_profile_enabled", event.target.checked)} />
            Let others visit my public profile
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={profile.show_posts} onChange={event => change("show_posts", event.target.checked)} />
            Show my public posts on my profile
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {saved && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">Your profile was saved to your account.</p>}
          <button type="submit" className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground" disabled={phase === "saving"}>{phase === "saving" ? "Saving…" : "Save profile"}</button>
        </fieldset>
      </form>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">2. Connect your accounts (optional)</h2>
        <p className="text-sm text-muted-foreground">Choose which provider to authorize. A public profile link is not permission to publish on that account.</p>
        <Link className={buttonClass} to="/connections">Manage connections</Link>
      </section>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold">3. Start fundraising</h2>
        <p className="text-sm text-muted-foreground">Explore campaigns or write a private draft. Saving or publishing requires your explicit action.</p>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonClass} to="/create">Create a campaign</Link>
          <Link className={buttonClass} to="/dashboard">Go to dashboard</Link>
          <Link className={buttonClass} to="/discover">Explore campaigns</Link>
        </div>
      </section>
    </>}
  </main>;
}
