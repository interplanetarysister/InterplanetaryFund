import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserRound } from "lucide-react";
import DriveImageButton from "@/components/DriveImageButton";
import { authClient } from "@/api/auth";
import { avatarUrl, loadMyProfile, profilePhotoRequest, saveMyProfile } from "@/lib/memberProfile";

const panel = "space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6";
const input = "mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3";
const action = "inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold";

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [photo, setPhoto] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadMyProfile();
      const available = new Set(data.campaigns.map(campaign => campaign.id));
      setProfile({
        ...data,
        display_name: data.display_name || "",
        handle: data.handle || "",
        featured_campaign_ids: data.featured_campaign_ids.filter(id => available.has(id)),
      });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const profileId = profile?.id;
  const photoKey = profile?.avatar_key;
  useEffect(() => {
    setPhoto("");
    setPhotoError("");
    if (!profileId || !photoKey) return;
    let active = true;
    let objectUrl;
    profilePhotoRequest(avatarUrl(profileId, photoKey))
      .then(result => result.blob())
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPhoto(objectUrl);
      })
      .catch(() => { if (active) setPhotoError("Your saved photo could not be displayed."); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profileId, photoKey]);

  function change(field, value) {
    setProfile(current => ({ ...current, [field]: value }));
    setNotice("");
  }

  async function act(label, operation) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (cause) {
      setError(cause.message || "The change could not be saved.");
    } finally {
      setBusy("");
    }
  }

  async function updatePhoto(file) {
    if (file && file.size > 2 * 1024 * 1024) {
      setError("Choose an image under 2 MB.");
      return;
    }
    await act("photo", async () => {
      const result = await profilePhotoRequest("/api/profile/avatar", {
        method: file ? "PUT" : "DELETE",
        ...(file && { body: file }),
      });
      const key = file ? (await result.json()).key : null;
      setProfile(current => ({ ...current, avatar_key: key }));
      setNotice(file ? "Profile photo saved." : "Profile photo removed.");
    });
  }

  if (loading) return <div role="status" className="mx-auto max-w-3xl p-8">Loading your profile…</div>;
  if (!profile) return <div className="mx-auto max-w-3xl space-y-3 p-8">
    <h1 className="text-3xl font-semibold">My Profile</h1>
    <p role="alert">{error}</p>
    <button type="button" className={action} onClick={load}>Retry</button>
  </div>;

  return <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-3xl font-bold">My Profile</h1>
      <Link to={`/u/${profile.id}`} className={action}>View public profile</Link>
    </header>
    <section className={panel} aria-labelledby="profile-account">
      <h2 id="profile-account" className="text-xl font-semibold">Account</h2>
      <p className="break-all text-sm text-muted-foreground">{profile.email}</p>
      <div className="flex flex-wrap items-center gap-4">
        {photo ? <img src={photo} alt="Your profile photo" className="size-16 rounded-full object-cover" /> :
          <UserRound aria-hidden="true" className="size-16 rounded-full border border-border p-3" />}
        <label className="min-w-0 flex-1 text-sm font-medium">
          Profile photo
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)}
            className="mt-2 block max-w-full file:mr-2 file:min-h-11 file:rounded-xl file:border-0 file:px-3"
            onChange={event => {
              const file = event.currentTarget.files[0];
              event.currentTarget.value = "";
              if (file) updatePhoto(file);
            }} />
          <span className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Up to 2 MB.</span>
        </label>
        <DriveImageButton onFile={updatePhoto} disabled={Boolean(busy)} maxBytes={2 * 1024 * 1024} className={action} />
        {photoKey && <button type="button" className={action} disabled={Boolean(busy)} onClick={() => updatePhoto(null)}>Remove photo</button>}
      </div>
      {photoError && <p role="alert" className="text-sm">{photoError}</p>}
    </section>
    <form className={panel} onSubmit={event => {
      event.preventDefault();
      act("profile", async () => {
        const saved = await saveMyProfile(profile);
        setProfile({ ...saved, display_name: saved.display_name || "", handle: saved.handle || "" });
        setNotice("Profile saved.");
      });
    }}>
      <h2 className="text-xl font-semibold">Public profile</h2>
      <fieldset disabled={Boolean(busy)} className="space-y-4 disabled:opacity-75">
        <legend className="sr-only">Profile details</legend>
        <label className="block font-medium">Display name
          <input required={profile.public_profile_enabled} maxLength={100} className={input} value={profile.display_name} onChange={e => change("display_name", e.target.value)} />
        </label>
        <label className="block font-medium">Handle
          <input maxLength={32} pattern="[A-Za-z0-9_\\-]{3,32}" aria-describedby="handle-help" className={input} value={profile.handle} onChange={e => change("handle", e.target.value)} />
          <span id="handle-help" className="mt-1 block text-xs text-muted-foreground">3–32 letters, numbers, underscores, or hyphens.</span>
        </label>
        <label className="block font-medium">Bio
          <textarea maxLength={900} rows={4} className={`${input} py-2`} value={profile.bio} onChange={e => change("bio", e.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={profile.public_profile_enabled} onChange={e => change("public_profile_enabled", e.target.checked)} />
          Publish my public profile
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={profile.show_posts} onChange={e => change("show_posts", e.target.checked)} />
          Show my posts on my profile
        </label>
        <fieldset className="space-y-1">
          <legend className="font-medium">Featured campaigns</legend>
          <p className="text-sm text-muted-foreground">Choose up to six active campaigns you own or follow. Your first selection appears first.</p>
          {profile.campaigns.length === 0 ? <Link to="/discover" className="text-primary underline">Discover campaigns</Link> :
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border px-3">
              {profile.campaigns.map(campaign => {
                const selected = profile.featured_campaign_ids;
                const checked = selected.includes(campaign.id);
                return <label key={campaign.id} className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" checked={checked} disabled={!checked && selected.length === 6}
                    onChange={() => change("featured_campaign_ids", checked ? selected.filter(id => id !== campaign.id) : [...selected, campaign.id])} />
                  {campaign.title}
                </label>;
              })}
            </div>}
        </fieldset>
        <button type="submit" className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{busy === "profile" ? "Saving…" : "Save profile"}</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="rounded-xl border border-destructive p-3">{error}</p>}
    {(notice || busy === "photo") && <p role="status" className="text-primary">{notice || "Updating your photo…"}</p>}
    <section className={panel}>
      <h2 className="text-xl font-semibold">Your workspace</h2>
      <div className="flex flex-wrap gap-2">
        {[
          ["/campaigns", "My Campaigns"], ["/following", "Following"], ["/my-blog", "My Blog"],
          ["/connections", "Connections"], ["/notifications", "Notifications"], ["/preferences", "Communication preferences"], ["/help", "Help Center"],
        ].map(([to, label]) => <Link key={to} to={to} className={action}>{label}</Link>)}
        <button type="button" className={action} disabled={Boolean(busy)} onClick={() => act("sign-out", async () => {
          const { error: signOutError } = await authClient().auth.signOut();
          if (signOutError) throw new Error("Sign-out failed. Try again.");
          navigate("/login", { replace: true });
        })}>Sign out</button>
      </div>
    </section>
  </div>;
}
