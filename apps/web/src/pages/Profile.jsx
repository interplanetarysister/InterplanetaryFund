import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { normalizeProfileInput } from "@/lib/profileInput";
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
        const { data: authData, error: authError } = await client.auth.getUser();
        const current = authData?.user;
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
      const normalized = normalizeProfileInput(profile);
      const client = authClient();
      const { data: currentAuth, error: authError } = await client.auth.getUser();
      if (authError || currentAuth?.user?.id !== user.id) {
        throw new Error("Your session has changed. Please sign in again.");
      }
      const { data: savedRow, error: saveError } = await client.from("ifund_profiles")
        .upsert({ id: user.id, ...normalized }, { onConflict: "id" })
        .select("id,display_name,handle").single();
      if (saveError || !savedRow || savedRow.id !== user.id ||
          savedRow.display_name !== normalized.display_name ||
          savedRow.handle !== normalized.handle) {
        throw new Error("Your profile could not be verified after saving.");
      }
      setProfile({ display_name: savedRow.display_name || "", handle: savedRow.handle || "" });
      setMessage("Profile saved.");
    } catch (err) {
      const message = err?.message || "";
      setError(/^(Handles must|Display name must|Your session has changed|Your profile could not be verified)/.test(message)
        ? message : "Unable to save profile.");
    }
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
