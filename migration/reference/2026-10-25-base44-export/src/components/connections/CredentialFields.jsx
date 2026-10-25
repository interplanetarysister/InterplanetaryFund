import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

// Platform-specific integration credentials. Secret fields (Ko-fi token,
// Bluesky app password, Mastodon access token) are NEVER preloaded — the edit
// form receives them blanked with a credentials_meta "set" flag, so raw secrets
// never live in frontend state. The user types a new value to replace; leaving
// it blank preserves the stored value (merged server-side). Non-secret
// identifiers (handles, instances) load normally.
const SECRET_NOTE = "Currently set — enter a new value to replace it. Leave blank to keep the current one.";

export default function CredentialFields({ platformId, credentials, credentialsMeta, onChange }) {
  const [reveal, setReveal] = useState({});
  const set = (key, value) => onChange({ ...credentials, [key]: value });
  const isSet = (key) => !!credentialsMeta?.[key + "_set"];
  const secretField = (key, label, placeholder, note) => (
    <div className="space-y-2" key={key}>
      <Label htmlFor={"credential-" + key}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={"credential-" + key} autoComplete="off" spellCheck={false}
          type={reveal[key] ? "text" : "password"}
          value={credentials[key] || ""}
          onChange={(event) => set(key, event.target.value)}
          placeholder={isSet(key) ? "Saved — enter a new value to replace" : placeholder}
          className="min-w-0 flex-1" />
        <Button type="button" variant="outline" className="min-h-11 shrink-0"
          aria-label={reveal[key] ? "Hide " + label : "Show " + label}
          aria-pressed={!!reveal[key]}
          onClick={() => setReveal((current) => ({ ...current, [key]: !current[key] }))}>
          {reveal[key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          <span className="sr-only">{reveal[key] ? "Hide" : "Show"}</span>
        </Button>
      </div>
      {isSet(key) && <p className="text-sm text-emerald-700">{SECRET_NOTE}</p>}
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
  return (
    <section aria-label="Account and integration details" className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">Account and sign-in details</h3>
        <p className="text-sm text-muted-foreground mt-1">Save the username or email associated with this platform so you can identify the correct account later. Never enter your regular website password here.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="platform-account-identifier">Login email or username (optional)</Label>
        <Input id="platform-account-identifier" autoComplete="off" maxLength={254}
          value={credentials.account_identifier || ""}
          onChange={(event) => set("account_identifier", event.target.value)}
          placeholder="Your account email or username" />
      </div>
      {platformId === "kofi" && <>
        {secretField("kofi_verification_token", "Ko-fi webhook verification token", "Token from your Ko-fi settings", "Use a provider-generated integration token, not your Ko-fi sign-in password.")}
        <p className="text-sm text-muted-foreground">Then configure Ko-fi webhooks to send events to: <code className="break-all">{window.location.origin}/functions/kofiWebhook</code></p>
      </>}
      {platformId === "buymeacoffee" && <>
        {secretField("buymeacoffee_api_token", "Buy Me a Coffee read-only API token", "Token from the developer dashboard", "A developer access token is not your sign-in password. Its API may be limited; this does not grant posting or automated login. IFund requires encrypted server storage before accepting the token.")}
        <p className="text-sm text-muted-foreground">For current event updates, Buy Me a Coffee supports signed webhooks under Integrations. API access alone does not establish a working event connection.</p>
      </>}
      {platformId === "bluesky" && <>
        <div className="space-y-2">
          <Label htmlFor="bluesky-handle">Bluesky handle</Label>
          <Input id="bluesky-handle" value={credentials.bluesky_handle || ""}
            onChange={(event) => set("bluesky_handle", event.target.value)} placeholder="you.bsky.social" />
        </div>
        {secretField("bluesky_app_password", "Bluesky app password", "From Bluesky Settings → App Passwords", "Use a dedicated app password rather than your main account password.")}
      </>}
      {platformId === "mastodon" && <>
        <div className="space-y-2">
          <Label htmlFor="mastodon-instance">Mastodon instance</Label>
          <Input id="mastodon-instance" value={credentials.mastodon_instance || ""}
            onChange={(event) => set("mastodon_instance", event.target.value)} placeholder="mastodon.social" />
        </div>
        {secretField("mastodon_access_token", "Mastodon access token", "Provider-issued access token", "Use a token with only the permissions you approve.")}
      </>}
      {!["kofi", "buymeacoffee", "bluesky", "mastodon"].includes(platformId) && (
        <p className="text-sm text-muted-foreground">For this provider, sign-in must use its supported authorization flow. IFund cannot use a saved website password to bypass provider permissions.</p>
      )}
    </section>
  );
}
