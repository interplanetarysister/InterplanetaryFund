import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

const HANDLE = /^[A-Za-z0-9_-]{3,32}$/;
export default function Profile({ user }) {
  const navigate = useNavigate();
  const [record, setRecord] = useState({ handle: "", display_name: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const saveRef = useRef(false);
  const avatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotice("");
    setError("");
    if (!user || !db) { setLoading(false); return; }
    db.from("ifund_profiles").select("handle, display_name").eq("id", user.id)
      .maybeSingle().then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(loadError.message);
        else setRecord({
          handle: data?.handle || "",
          display_name: data?.display_name || "",
        });
        setLoading(false);
      }).catch((cause) => {
        if (cancelled) return;
        setError(cause?.message || "Could not load your profile.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function save(event) {
    event.preventDefault();
    if (!user || !db || saveRef.current) return;
    const handle = record.handle.trim();
    const display_name = record.display_name.trim();
    if (handle && !HANDLE.test(handle)) {
      setError("Use 3–32 letters, numbers, hyphens or underscores for your handle.");
      return;
    }
    if (display_name.length > 100) {
      setError("Display name must be 100 characters or fewer.");
      return;
    }
    saveRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const { error: saveError } = await db.from("ifund_profiles")
        .upsert({ id: user.id, handle: handle || null, display_name }, { onConflict: "id" });
      if (saveError) throw saveError;
      setNotice("Profile saved.");
    } catch (cause) {
      setError(cause?.code === "23505"
        ? "That handle is already taken."
        : (cause?.message || "Profile could not be saved."));
    } finally {
      saveRef.current = false; setBusy(false);
    }
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !db || !user) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError("Use a JPG, PNG or WebP image smaller than 5 MB.");
      return;
    }
    setPhotoBusy(true); setError(""); setNotice("");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + ext;
    try {
      const { error: uploadError } = await db.storage.from("ifund-profile-images")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = db.storage.from("ifund-profile-images").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("The uploaded photo could not be displayed.");
      const { error: updateError } = await db.auth.updateUser({ data: { avatar_url: data.publicUrl } });
      if (updateError) throw updateError;
      setNotice("Profile photo updated.");
    } catch (cause) {
      setError("Photo update failed: " + (cause?.message || "Please retry."));
    } finally { setPhotoBusy(false); }
  }

  async function signOut() {
    if (!db || busy) return;
    setBusy(true); setError("");
    try {
      const { error: authError } = await db.auth.signOut();
      if (authError) throw authError;
      navigate("/login");
    } catch (cause) {
      setError(cause?.message || "Could not sign out.");
      setBusy(false);
    }
  }

  if (!user) return <main><h1>Your profile</h1>
    <p>Sign in to manage your account.</p><Link className="primary" to="/login">Sign in</Link></main>;
  return <main className="profile-page">
    <h1>Profile</h1>
    <p>Your account, campaign identity, and connected platforms.</p>
    <div className="card">
      <h2>Account</h2>
      <div className="profile-identity">
        {avatar ? <img src={avatar} alt="Your current profile" className="profile-avatar" />
          : <div className="profile-avatar profile-avatar-fallback" aria-hidden="true">IF</div>}
        <div><strong>{record.display_name || user.email || "Account"}</strong>
          <small>{user.email}</small></div>
      </div>
      <label className="profile-upload">Upload profile photo
        <input type="file" accept="image/jpeg,image/png,image/webp"
          onChange={uploadPhoto} disabled={photoBusy || busy} />
      </label>
      {photoBusy && <p role="status">Uploading your profile photo…</p>}
      {loading ? <Loading /> : <form className="form" onSubmit={save}>
        <label>Display name
          <input value={record.display_name} maxLength={100}
            onChange={(e) => setRecord((r) => ({ ...r, display_name: e.target.value }))}
            autoComplete="nickname" /></label>
        <label>Handle
          <input value={record.handle} maxLength={32}
            placeholder="your-handle"
            onChange={(e) => setRecord((r) => ({ ...r, handle: e.target.value }))}
            autoCapitalize="none" /></label>
        <small>Handles may use letters, numbers, underscores and hyphens.</small>
        <button type="submit" className="primary" disabled={!db || busy}>
          {busy ? "Saving…" : "Save profile"}</button>
      </form>}
    </div>
    <Message error={Boolean(error)}>{error || notice}</Message>
    <div className="cards">
      <Link to="/mine" className="card"><h3>My campaigns</h3><p>Manage active fundraisers and return to drafts.</p></Link>
      <Link to="/connections" className="card"><h3>Connected platforms</h3><p>Review your verified integrations.</p></Link>
      <Link to="/dashboard" className="card"><h3>Dashboard</h3><p>View your campaign activity and quick actions.</p></Link>
    </div>
    <div className="actions"><button type="button" className="secondary" onClick={signOut}
      disabled={!db || busy}>Sign out</button></div>
  </main>;
}
