import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import CredentialFields from "./CredentialFields";
import PasswordVaultPanel from "./PasswordVaultPanel";
import AccountAiScope from "./AccountAiScope";
import VerificationInboxPanel from "@/components/inbox/VerificationInboxPanel";
import { Link } from "react-router-dom";
import { officialProviderSite } from "@/lib/providerOnboardingLinks";
import { providerAuthorizationDestination } from "@/lib/providerAuthorizationDestination";

const OAUTH_ATTEMPT_BLOCKED_STATES = new Set(["checking", "not_configured", "unsupported"]);

// Connect (or edit) one destination. Crowdfunding connections link an external
// campaign page and its totals; social connections link an account and set the
// AI automation permission for that destination.
export default function ConnectDialog({ platform, existing, aiAuthorized, managedAvailable = false, onManagedCreateAccount, onManagedConnect, open, onOpenChange, onSaved, onAccountConsentChanged }) {
  const accountDetailsRef = useRef(null);
  const isCrowd = platform.kind === "crowdfunding";
  const usesProviderOAuth = platform.setupKind === "oauth";
  const [form, setForm] = useState({ display_name: "", external_url: "", campaign_id: "", automation_mode: "manual", external_total: "", external_currency: "USD", external_donor_count: "" });
  const [credentials, setCredentials] = useState({});
  const [balanceReaffirmed, setBalanceReaffirmed] = useState(false);
  const [accountAiAllowed, setAccountAiAllowed] = useState(false);
  const [scopeChoice, setScopeChoice] = useState("full");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [managedBusy, setManagedBusy] = useState(false);
  const [helpDetails, setHelpDetails] = useState("");
  const [error, setError] = useState("");
  const [oauthReadiness, setOauthReadiness] = useState("checking");
  const [oauthReadinessPlatform, setOauthReadinessPlatform] = useState("");
  const oauthAttemptBlocked = usesProviderOAuth &&
    (oauthReadinessPlatform !== platform.id || OAUTH_ATTEMPT_BLOCKED_STATES.has(oauthReadiness));

  useEffect(() => {
    if (!open) return;
    setForm({
      display_name: existing?.display_name || "",
      external_url: existing?.external_url || "",
      campaign_id: existing?.campaign_id || "",
      automation_mode: existing?.automation_mode || "auto",
      external_total: existing?.external_total ?? "",
      external_currency: existing ? (existing.external_currency || "") : "USD",
      external_donor_count: existing?.external_donor_count ?? "",
    });
    setCredentials(existing?.credentials || {});
    setBalanceReaffirmed(false);
    setScopeChoice(existing?.obo_consent?.scope_choice || "full");
    setAccountAiAllowed(existing?.obo_consent?.granted === true && existing?.obo_consent?.opted_out !== true);
    setHelpDetails("");
    base44.auth.me()
      .then((me) => base44.entities.Campaign.filter({ created_by_id: me.id }))
      .then((rows) => setCampaigns((rows || []).filter((campaign) => campaign.status === "active" || campaign.id === existing?.campaign_id)))
      .catch(() => setCampaigns([]));
  }, [open, existing]);

  useEffect(() => {
    if (!open || !usesProviderOAuth) return;
    let current = true;
    setOauthReadinessPlatform("");
    setOauthReadiness("checking");
    base44.functions.invoke("getAppUserConnector", { platform: platform.id })
      .then(({ data }) => {
        if (!current) return;
        setOauthReadinessPlatform(platform.id);
        setOauthReadiness(!data?.supported ? "unsupported" :
          data?.readiness === "authorization_present" ? "authorization_present" :
          data?.can_attempt && data?.connector_id ? "registration_unverified" : "not_configured");
      })
      .catch(() => {
        if (!current) return;
        setOauthReadinessPlatform(platform.id);
        setOauthReadiness("unavailable");
      });
    return () => { current = false; };
  }, [open, platform.id, usesProviderOAuth]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (["external_url", "external_currency", "external_total", "external_donor_count"].includes(k)) setBalanceReaffirmed(false);
  };
  const externalIdentityChanged = Boolean(existing && isCrowd && (
    platform.id !== existing.platform ||
    (platform.kind || 'crowdfunding') !== (existing.kind || 'crowdfunding') ||
    form.external_url.trim() !== String(existing.external_url || "").trim() ||
    form.external_currency.trim().toUpperCase() !== String(existing.external_currency || "").trim().toUpperCase() ||
    Object.entries(credentials).some(([key, value]) =>
      ["kofi_verification_token", "buymeacoffee_api_token", "bluesky_app_password", "mastodon_access_token", "account_identifier"].includes(key) &&
      String(value ?? "").trim() !== "" && String(value).trim() !== String(existing?.credentials?.[key] ?? "").trim())
  ));
  const hasDisplayedBalance = Number(form.external_total || 0) > 0 || Number(form.external_donor_count || 0) > 0;
  const balanceReaffirmationRequired = externalIdentityChanged && hasDisplayedBalance && !balanceReaffirmed;
  const selectedCampaign = campaigns.find((campaign) => campaign.id === form.campaign_id) || null;
  const selectCampaign = (campaignId) => {
    const selected = campaigns.find((campaign) => campaign.id === campaignId);
    setForm((current) => ({
      ...current,
      campaign_id: campaignId,
      // Pairing a campaign also names the connection after that campaign so the
      // user never has to type the same title twice.
      display_name: selected?.title || current.display_name || "",
    }));
  };

  const blockOAuthAttempt = () => {
    if (!oauthAttemptBlocked) return false;
    setError(oauthReadiness === "checking"
      ? `IFund is still checking ${platform.name} sign-in setup.`
      : `IFund cannot start ${platform.name} sign-in until its provider setup is available.`);
    return true;
  };

  const connectWithProvider = async () => {
    if (connecting || blockOAuthAttempt()) return;
    setConnecting(true);
    setError("");
    try {
      if (accountAiAllowed && !aiAuthorized) throw new Error("Turn on IFund-wide AI help first.");
      const { data } = await base44.functions.invoke("getAppUserConnector", { platform: platform.id });
      if (!data?.supported) {
        setError("This platform does not offer verified provider sign-in through IFund yet.");
        return;
      }
      if (!data?.can_attempt || !data?.connector_id) {
        setError(platform.id === "facebook"
          ? "Facebook Pages publishing has not been configured for IFund yet. Facebook sign-in does not grant posting permission."
          : `IFund has not enabled ${platform.name} account sign-in yet. This is an IFund connection setup issue, not something you need to configure on ${platform.name}. The account has not been connected.`);
        return;
      }
      const me = await base44.auth.me();
      if (!me?.id) throw new Error("Sign in to IFund first.");
      // Persist the resume hint BEFORE asking the SDK for an authorization URL:
      // an SDK may immediately navigate away. Never store codes or tokens here.
      localStorage.setItem("ifund_pending_platform_connection", JSON.stringify({
        platform: platform.id, userId: me.id, startedAt: Date.now(),
        accountAiAllowed, aiScopeChoice: scopeChoice,
        step: "oauth_pending",
        campaignId: form.campaign_id || "",
        campaignTitle: selectedCampaign?.title || form.display_name || "",
        displayName: selectedCampaign?.title || form.display_name || "",
        returnPath: "/connections",
      }));
      // A single-tab flow preserves the IFund origin/session on mobile and
      // avoids popup callbacks landing in an unrelated Base44 editor window.
      // An account can be connected before its first IFund campaign is chosen.
      // Provider identity linking should not depend on campaign creation.
      const redirectUrl = await base44.connectors.connectAppUser(data.connector_id);
      if (!redirectUrl) throw new Error("Provider did not return a sign-in URL.");
      const destination = new URL(String(redirectUrl));
      if (destination.protocol !== "https:" || destination.username || destination.password) {
        throw new Error("Provider sign-in URL is not secure.");
      }
      // A successful authorization initiation must point to a permissions
      // flow, not silently strand the member on the provider homepage.
      window.location.assign(providerAuthorizationDestination(destination.href, officialProviderSite(platform.id)));
    } catch (e) {
      localStorage.removeItem("ifund_pending_platform_connection");
      console.error("Provider OAuth start failed:", e?.name || "ProviderConnectionError");
      const missingPermissionsLink = e?.message?.includes("homepage rather than a permissions link");
      setError(missingPermissionsLink
        ? `IFund did not receive a ${platform.name} permission request. Your account was not connected. IFund must repair this provider setup.`
        : "The provider connection could not start. Try Connect again for a fresh authorization link.");
    } finally {
      setConnecting(false);
    }
  };

  // Deep links open this IFund window first. The user chooses Connect before
  // leaving IFund for the provider permission screen; never auto-redirect.

  const startGuidedConnection = async () => {
    if (managedBusy || blockOAuthAttempt()) return;
    setManagedBusy(true);
    setError("");
    try {
      if (managedAvailable && onManagedConnect) {
        const result = await onManagedConnect({ campaign_id: form.campaign_id || undefined });
        if (result?.state === "completed") {
          setHelpDetails("This connection was verified as working.");
          return;
        }
        setHelpDetails(result?.message || "The connection agent has recorded the next required step. IFund will not show this account as connected until the provider verifies it.");
      } else {
        setHelpDetails("Follow the provider’s sign-in and authorization instructions here. Agent-managed setup requires an eligible subscription and IFund help permission.");
      }
      if (usesProviderOAuth) {
        // This user gesture starts actual provider sign-in, not a fake
        // IFund-generated verification code. The provider owns MFA.
        await connectWithProvider();
      } else if (platform.setupKind === "link") {
        setHelpDetails("Open the platform in your browser, sign in if needed, copy your real campaign/profile URL and paste it into the field above. IFund checks supported public data after saving.");
      } else {
        setHelpDetails("The account detail fields are highlighted above. Enter a platform-issued token only if available; do not enter your regular website password. Saving details does not mean provider verification succeeded.");
        accountDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        accountDetailsRef.current?.querySelector("input")?.focus({ preventScroll: true });
      }
    } catch (e) {
      console.error("Managed account connection start failed:", e?.name || "ManagedConnectionError");
      setError("The connection request could not start.");
    } finally { setManagedBusy(false); }
  };

  const requestManagedAccountSetup = async () => {
    if (!onManagedCreateAccount || managedBusy) return;
    setManagedBusy(true);
    setError("");
    try {
      await onManagedCreateAccount({ campaign_id: form.campaign_id || undefined });
    } catch {
      setError("IFund couldn't start managed account setup. Try again.");
    } finally {
      setManagedBusy(false);
    }
  };

  const changeAccountAi = async (nextValue) => {
    if (!aiAuthorized && nextValue) {
      setError("Turn on IFund-wide AI help on the Connections page first.");
      return;
    }
    if (!existing?.id) { setAccountAiAllowed(nextValue); return; }
    setPermissionBusy(true); setError("");
    try {
      const { data } = await base44.functions.invoke("setConnectionAiToggle", {
        connection_id: existing.id, enabled: nextValue,
      });
      if (!data?.ok) throw new Error(data?.error || "Could not change account permission.");
      setAccountAiAllowed(nextValue);
      onAccountConsentChanged?.(existing.id, nextValue);
      setHelpDetails(nextValue
        ? "AI is on for this account within the approved scope and provider permissions."
        : "AI is off for this account. The provider connection stays in place.");
    } catch { setError("Could not change AI access. Try again."); }
    finally { setPermissionBusy(false); }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (accountAiAllowed && !aiAuthorized) throw new Error("Turn on IFund-wide AI help first.");
      // Route through the credential-merge function so secret values never
      // round-trip through the frontend and merges preserve unchanged secrets.
      const res = await base44.functions.invoke("saveConnectionCredentials", {
        connection_id: existing?.id,
        platform: platform.id,
        kind: platform.kind,
        display_name: form.display_name,
        external_url: form.external_url,
        campaign_id: form.campaign_id || undefined,
        automation_mode: form.automation_mode,
        external_total: isCrowd ? Number(form.external_total) || 0 : 0,
        external_currency: isCrowd ? form.external_currency.trim().toUpperCase() : undefined,
        external_donor_count: isCrowd ? Number(form.external_donor_count) || 0 : 0,
        credentials,
        balance_reaffirmed: externalIdentityChanged && balanceReaffirmed,
        ai_account_authorized: accountAiAllowed,
        ai_scope_choice: scopeChoice,
      });
      const saved = res.data.connection;
      onSaved(saved || { ...existing, display_name: form.display_name, external_url: form.external_url });
      onOpenChange(false);
    } catch (e) {
      console.error("ConnectDialog connection save failed:", e?.name || "ConnectionSaveError");
      setError("Couldn't save this connection. Please try again. If the problem continues, contact support.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg sm:max-w-md min-w-0 rounded-2xl max-h-[calc(100dvh-1.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y pb-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{existing ? "Manage" : platform.setupKind === "link" ? "Link a page on" : "Connect"} {platform.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">{existing?.status === "connected" && existing?.verification_status === "verified" ? "On" : existing ? "Needs attention" : "Off"} · {usesProviderOAuth ? "Sign in on the platform and approve its permissions. No post will be sent." : platform.setupKind === "link" ? "This links an existing public fundraising page. It does not authorize account access or publishing." : "Follow the official connection steps below."}</p>
        {usesProviderOAuth && <AccountAiScope platform={platform} checked={accountAiAllowed} onChange={changeAccountAi} existing={!!existing} legacyScope={!!existing && !existing.obo_consent?.scope_choice} scopeChoice={scopeChoice} onScopeChange={setScopeChoice} globalEnabled={aiAuthorized} busy={permissionBusy} />}
        {usesProviderOAuth && (
          <div className="space-y-3 min-w-0">
            <p className="text-sm text-foreground">{connecting ? `Opening ${platform.name} sign-in…` : "One link. Provider sign-in. Back to IFund for verification."}</p>
            <Button type="button" onClick={connectWithProvider} disabled={connecting || oauthAttemptBlocked} className="w-full min-h-12 whitespace-normal h-auto py-3 break-words">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {connecting ? "Opening secure sign-in…" : oauthReadiness === "checking" ? "Checking sign-in…" : oauthReadiness === "not_configured" ? "IFund setup required" : oauthReadiness === "unsupported" ? "Sign-in unavailable" : existing ? `Reconnect ${platform.name}` : `Connect ${platform.name}`}
            </Button>
            {error && <p role="alert" className="text-sm text-red-600 break-words">{error}</p>}
            {oauthReadiness === "not_configured" && <p role="status" className="text-sm text-amber-700">IFund needs to finish this platform's user-login registration before this link can work. Nothing is wrong with your account.</p>}
          </div>
        )}
        <p className="text-sm"><Link className="underline text-primary font-semibold" to="/help/connect-another-platform">Read easy steps to connect this app</Link></p>
        <div className="min-w-0 w-full space-y-4">
          {!usesProviderOAuth && <div className="space-y-1.5">
            <Label>{isCrowd ? "Campaign name on that platform" : "Account name / handle"}</Label>
            <Input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder={isCrowd ? "e.g. Help Rebuild Our Shelter" : "e.g. @interplanetaryfund"} />
          </div>}
          {!usesProviderOAuth && <div className="space-y-1.5">
            <Label>{isCrowd ? "External campaign URL" : "Profile URL"}</Label>
            <Input value={form.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://…" />
          </div>}
          {!usesProviderOAuth && <div ref={accountDetailsRef}><CredentialFields platformId={platform.id} credentials={credentials} credentialsMeta={existing?.credentials_meta || {}} onChange={(nextCredentials) => { setCredentials(nextCredentials); setBalanceReaffirmed(false); }} /></div>}
          {!usesProviderOAuth && <div className="space-y-1.5">
            <Label>{platform.kind === "app" ? "Linked Interplanetary Fund campaign" : "Optional campaign to promote"}</Label>
            <Select value={form.campaign_id} onValueChange={selectCampaign}>
              <SelectTrigger className="min-w-0 w-full"><SelectValue placeholder={platform.kind === "app" ? "Optional — pick a campaign" : "Pick the campaign to publish first"} /></SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}
          {!usesProviderOAuth && platform.kind !== "app" && selectedCampaign && (
            <div className="space-y-1.5">
              <Label>Connection title</Label>
              <p className="w-full min-w-0 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-foreground break-words [overflow-wrap:anywhere]" aria-label="Connection title">{form.display_name}</p>
              <p className="text-xs text-muted-foreground">This title follows the paired Interplanetary Fund campaign automatically.</p>
            </div>
          )}
          {isCrowd && !usesProviderOAuth && (
            <div className="space-y-2">
              <p className="text-xs text-stone-500">Enter the numbers shown on the other fundraiser. We’ll label them as confirmed only after we can check them.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Reported total</Label>
                  <Input type="number" min="0" step="0.01" value={form.external_total} onChange={(e) => set("external_total", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={form.external_currency} maxLength={3} onChange={(e) => set("external_currency", e.target.value.toUpperCase())} placeholder="USD" />
                </div>
                <div className="space-y-1.5">
                  <Label>Reported donors</Label>
                  <Input type="number" min="0" step="1" value={form.external_donor_count} onChange={(e) => set("external_donor_count", e.target.value)} placeholder="0" />
                </div>
              </div>
              {externalIdentityChanged && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  {hasDisplayedBalance ? (
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={balanceReaffirmed} onChange={event => setBalanceReaffirmed(event.target.checked)} />
                      <span>I confirm this displayed amount, currency, and donor count belong to the changed provider connection.</span>
                    </label>
                  ) : <p>The prior provider balance evidence will be cleared for this changed connection.</p>}
                </div>
              )}
            </div>
          )}

          {!usesProviderOAuth && <AccountAiScope platform={platform} checked={accountAiAllowed} onChange={changeAccountAi} existing={!!existing} legacyScope={!!existing && !existing.obo_consent?.scope_choice} scopeChoice={scopeChoice} onScopeChange={setScopeChoice} globalEnabled={aiAuthorized} busy={permissionBusy} />}
          <PasswordVaultPanel platform={platform} />
          <VerificationInboxPanel platform={platform.id} />
          {!usesProviderOAuth && <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">AI help: {aiAuthorized ? "On" : "Off"}</p>
            <p className="text-xs text-muted-foreground mt-1 break-words">{aiAuthorized ? "The big IFund AI switch is on. Each outside account needs its own AI switch, and only provider-approved actions will work." : "Turn on AI help on the Connections page if you want Interplanetary Fund to act on your behalf through connected platforms."}</p>
          </div>}
          {usesProviderOAuth && oauthReadiness === "unavailable" &&
            <p role="status" className="text-sm text-amber-600 break-words">IFund could not check the connection setup right now. You can retry Connect.</p>}
          {usesProviderOAuth && oauthReadiness === "unsupported" &&
            <p role="status" className="text-sm text-amber-600 break-words">Provider sign-in is not available for {platform.name} through IFund yet.</p>}
          {!usesProviderOAuth && error && <p role="alert" className="text-sm text-red-600 break-words">{error}</p>}
          {!usesProviderOAuth && <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="font-semibold text-sm text-foreground mb-2">How IFund connects {platform.name}</p>
            <ol className="list-decimal pl-4 space-y-2 text-xs text-foreground">
              {usesProviderOAuth && <li>IFund opens the official {platform.name} authorization. An existing provider session may be reused on this device.</li>}
              {(platform.steps||[]).filter(step=>step.id!=="auto").map(step=><li key={step.id}>
                <span className="font-medium">{platform.id === "buymeacoffee" && step.id === "token" ? "Use a provider-issued developer access token, not your password" : step.label}</span>
                {step.hint && <span className="block mt-0.5">{platform.id === "buymeacoffee" && step.id === "token" ? "Current integrations use signed webhooks in the Buy Me a Coffee Integrations dashboard; developer tokens may provide limited read-only data." : step.hint}</span>}
              </li>)}
              <li>Return to IFund for a provider verification check. If the account was not verified, the specific required step remains in your AI activity panel.</li>
            </ol>
          </div>}
          {!usesProviderOAuth && <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
            <p className="font-semibold text-sm text-foreground">IFund connection helper</p>
            <p className="text-xs text-muted-foreground">Use this when you are already signed in on the device or need a fresh provider sign-in. IFund can open supported authorization, guide you to the right platform settings, and then verify the connection. Verification codes come from the platform itself.</p>
            <Button type="button" size="sm" variant="outline" className="min-h-11 w-full text-foreground bg-card whitespace-normal h-auto py-3" disabled={managedBusy || connecting || oauthAttemptBlocked} onClick={startGuidedConnection}>
              {managedBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : platform.setupKind === "link" ? "Help me link this fundraising page" : "Help me connect — show account details"}
            </Button>
            {helpDetails && <p role="status" className="text-xs text-foreground break-words">{helpDetails}</p>}
          </div>}
          {!usesProviderOAuth && !existing && platform.kind !== "app" && officialProviderSite(platform.id) && (
            <div className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">
              <p className="font-semibold">Need a new {platform.name} account?</p>
              <p className="mt-1 text-xs text-muted-foreground">Sign up on the official provider website, then come back and connect that account. IFund only marks accounts connected after verification.</p>
              <a href={officialProviderSite(platform.id)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-primary px-3 py-2 text-center font-semibold text-primary underline">
                Open {platform.name} to sign up
              </a>
            </div>
          )}
          {!usesProviderOAuth && (
            <Button onClick={save} disabled={saving || balanceReaffirmationRequired} className="w-full min-w-0 bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 h-auto px-3 py-3 text-center whitespace-normal break-words leading-snug rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : existing ? "Save changes" : `Link to ${platform.name}`}
            </Button>
          )}
          {!existing && managedAvailable && onManagedCreateAccount && platform.kind !== "app" && (
            <Button type="button" variant="outline" onClick={requestManagedAccountSetup} disabled={managedBusy} className="w-full min-w-0 rounded-xl min-h-11 h-auto py-3 px-3 whitespace-normal break-words">
              {managedBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ask IFund to help set up a new account"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
