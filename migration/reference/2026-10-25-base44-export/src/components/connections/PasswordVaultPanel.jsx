import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LockKeyhole, Smartphone } from "lucide-react";
import { lockVaultEntry, unlockVaultEntry } from "@/lib/credentialVault";
import { officialProviderSite } from "@/lib/providerOnboardingLinks";

const VAULT_SAVE_HELP = new Set([
  "Enter a password to save.",
  "Vault passphrases do not match.",
  "Encrypted storage requires HTTPS.",
  "Use a vault passphrase of at least 12 characters.",
]);
const VAULT_UNLOCK_HELP = new Set([
  "Encrypted storage requires HTTPS.",
  "Unsupported vault version.",
  "Wrong passphrase or damaged entry. No password was revealed.",
]);

export default function PasswordVaultPanel({ platform }) {
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [visible, setVisible] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    setSaved(null); setPassword(""); setPassphrase(""); setVisible(false); setUnlocked(false);
    setError(""); setNotice(""); setLoading(true);
    base44.auth.me()
      .then(me => base44.entities.UserCredentialVault.filter({ user_id: me.id, platform: platform.id }))
      .then(rows => { if (active) setSaved(rows?.[0] || null); })
      .catch(() => { if (active) setError("The vault is unavailable. Passwords were not loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [platform.id]);
  const save = async () => {
    setError(""); setNotice(""); setBusy(true);
    try {
      if (!password) throw Error("Enter a password to save.");
      if (!saved && passphrase !== confirmPassphrase) throw Error("Vault passphrases do not match.");
      const sealed = await lockVaultEntry({ username, password }, passphrase);
      const me = await base44.auth.me();
      const data = { user_id: me.id, platform: platform.id, ...sealed, updated_at: new Date().toISOString() };
      const row = saved
        ? await base44.entities.UserCredentialVault.update(saved.id, data)
        : await base44.entities.UserCredentialVault.create({ ...data, created_at: data.updated_at });
      setSaved(row); setPassword(""); setPassphrase(""); setConfirmPassphrase("");
      setUnlocked(false); setVisible(false);
      setNotice("Encrypted entry saved. This does not connect or authorize the provider.");
    } catch (e) { setError(VAULT_SAVE_HELP.has(e?.message) ? e.message : "Could not save encrypted entry."); }
    finally { setBusy(false); }
  };
  const unlock = async () => {
    setError(""); setNotice(""); setBusy(true);
    try {
      const result = await unlockVaultEntry(saved, passphrase);
      setUsername(result.username); setPassword(result.password);
      setUnlocked(true); setVisible(false); setPassphrase("");
      setNotice("Unlocked on this device. Lock it again when finished.");
    } catch (e) { setError(VAULT_UNLOCK_HELP.has(e?.message) ? e.message : "Unlock failed."); }
    finally { setBusy(false); }
  };
  const lock = () => { setUsername(""); setPassword(""); setPassphrase(""); setConfirmPassphrase(""); setUnlocked(false); setVisible(false); };
  const remove = async () => {
    setError(""); setBusy(true);
    try { await base44.entities.UserCredentialVault.delete(saved.id); setSaved(null); lock(); setNotice("Vault entry deleted."); }
    catch { setError("Could not delete entry."); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Password manager options">
    <h3 className="text-base font-semibold flex items-center gap-2"><LockKeyhole className="w-5 h-5" /> Password manager options</h3>
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
      <p className="font-semibold text-sm flex items-center gap-2"><Smartphone className="w-4 h-4" /> Google Password Manager or device autofill</p>
      <p className="text-sm text-muted-foreground">Choose Connect to sign in on the provider's secure page. Android or your browser may offer saved credentials. IFund cannot read the Google password vault, and autofill does not grant AI publishing permission.</p>
    </div>
    {officialProviderSite(platform.id) && <a className="inline-flex items-center underline text-sm font-semibold text-primary break-words" href={officialProviderSite(platform.id)} target="_blank" rel="noopener noreferrer">Open the official {platform.name} site to sign in with device autofill</a>}
    <h4 className="font-semibold text-sm">Private IFund password vault</h4>
    <p className="text-sm text-muted-foreground">Optional, available for any platform. Credentials are encrypted on your device using your vault passphrase before saving. IFund staff and AI agents cannot read the stored password. A forgotten passphrase cannot be recovered.</p>
    {loading ? <p className="text-sm">Loading vault…</p> : <>
      <p className="text-sm font-semibold">{saved ? "Encrypted password saved for this platform" : "No saved password for this platform"}</p>
      {(!saved || unlocked) && <>
        <div className="space-y-1"><Label htmlFor="vault-username">Platform login name / email</Label><Input id="vault-username" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="vault-password">Platform password</Label>
          <div className="flex gap-2"><Input id="vault-password" autoComplete="off" className="min-w-0 flex-1" type={visible ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} />
            <Button type="button" variant="outline" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
          </div>
        </div>
      </>}
      <div className="space-y-1"><Label htmlFor="vault-master">Vault passphrase (12 characters minimum)</Label>
        <Input id="vault-master" autoComplete="off" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
      </div>
      {!saved && <div className="space-y-1"><Label htmlFor="vault-confirm">Confirm vault passphrase</Label>
        <Input id="vault-confirm" autoComplete="off" type="password" value={confirmPassphrase} onChange={e => setConfirmPassphrase(e.target.value)} />
      </div>}
      <div className="flex flex-wrap gap-2">
        {!saved || unlocked
          ? <Button type="button" disabled={busy || !password || passphrase.length < 12} onClick={save}>{busy ? "Saving…" : "Encrypt and save"}</Button>
          : <Button type="button" disabled={busy || !passphrase} onClick={unlock}>{busy ? "Unlocking…" : "Unlock saved entry"}</Button>}
        {unlocked && <Button type="button" variant="outline" onClick={lock}>Lock now</Button>}
        {saved && <Button type="button" variant="outline" disabled={busy} onClick={remove}>Delete stored entry</Button>}
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
  </section>;
}
