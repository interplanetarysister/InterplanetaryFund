import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ display_name: "", handle: "" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = authClient();
        const { data: { user: current }, error: authError } = await client.auth.getUser();
        if (!active) return;
        if (authError || !current) { navigate("/login", { replace: true }); return; }
        setUser(current);
        const { data, error: profileError } = await client.from("ifund_profiles").select("display_name,handle").eq("id", current.id).maybeSingle();
        if (profileError) throw profileError;
        if (active && data) setProfile({ display_name: data.display_name || "", handle: data.handle || "" });
      } catch { if (active) setError("Unable to load your profile."); }
      finally { if (active) setLoading(false); }
    }
    load(); return () => { active = false; };
  }, [navigate]);
  async function save(e) {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const handle = profile.handle.trim();
      if (handle && !/^[A-Za-z0-9_-]{3,32}$/.test(handle)) throw new Error("Handles must be 3–32 letters, numbers, underscores, or hyphens.");
      const { error: saveError } = await authClient().from("ifund_profiles").upsert({
        id: user.id, handle: handle || null, display_name: profile.display_name.trim() || null
      }, { onConflict: "id" });
      if (saveError) throw saveError;
      setMessage("Profile saved.");
    } catch (err) { setError(err?.message || "Unable to save profile."); }
    finally { setBusy(false); }
  }
  if (loading) return <main role="status" className="mx-auto max-w-3xl p-8">Loading profile…</main>;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">My profile</h1><p className="mt-2 text-muted-foreground">Manage your Interplanetary Fund identity.</p></header>
    {user && <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">Account email: {user.email}</p>
      <label className="block font-semibold">Display name<input maxLength={100} value={profile.display_name} onChange={e=>setProfile(p=>({...p,display_name:e.target.value}))} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Public handle<input maxLength={32} value={profile.handle} onChange={e=>setProfile(p=>({...p,handle:e.target.value}))} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" placeholder="your-handle" /></label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {message && <p role="status" className="text-primary">{message}</p>}
      <button disabled={busy} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save profile"}</button>
    </form>}
    <p className="text-sm text-muted-foreground">Avatar uploads, friends, and connected platforms are being migrated separately. <Link to="/connections" className="underline">Connections</Link></p>
  </main>;
}
