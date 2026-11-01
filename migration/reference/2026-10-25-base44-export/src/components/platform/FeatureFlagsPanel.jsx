import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logPlatformEvent } from "./logPlatformEvent";
import { Loader2, Plus } from "lucide-react";

// Based on exact backend feature-gate call sites. Connection alone does not
// certify a live external provider, payout route or AI execution capability.
const WIRED_FLAGS = new Set([
  "public_campaign_fundraising", "payment_checkout_enabled",
  "paypal_checkout", "google_pay_checkout", "apple_pay_checkout",
  "recurring_donations", "subscription_checkout",
  "outbound_payout_execution", "ai_campaign_assistant",
  "ai_outreach_agent", "social_autopilot", "cross_platform_publishing",
  "managed_connections", "external_campaign_import",
  "external_fund_collection", "external_feed_mirroring",
  "community_creation", "institution_programs",
  "crypto_donations",
]);
const ALWAYS_AVAILABLE = new Set([
  "new_campaign_publishing", "public_campaign_publishing",
  "paypal_donation_reconciliation",
]);
const NEEDS_EXTERNAL_VERIFICATION = new Set([
  "public_campaign_fundraising", "payment_checkout_enabled",
  "paypal_checkout", "google_pay_checkout", "apple_pay_checkout",
  "recurring_donations", "subscription_checkout",
  "outbound_payout_execution", "ai_campaign_assistant",
  "ai_outreach_agent", "social_autopilot", "cross_platform_publishing",
  "managed_connections", "external_campaign_import",
  "external_fund_collection", "external_feed_mirroring",
  "crypto_donations",
]);
const RETIRED_FLAGS = new Set(["outbound_payout_executiin", "ai_campaign_asisstant", "stripe_checkout", "recurring_donations"]);

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: "", label: "", description: "", scope: "global" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.entities.FeatureFlag.list("-created_date", 100).then(setFlags).catch(() => { setFlags([]); setError("Could not load feature flags. Reload and retry."); });
  }, []);

  if (!flags) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const create = async () => {
    setSaving(true);
    setError("");
    try {
      if (form.key.trim().toLowerCase() === "public_campaign_fundraising" && form.scope !== "global") {
        setError("Public campaign fundraising must use Global scope.");
        return;
      }
      const { data } = await base44.functions.invoke("manageFeatureFlag", form);
      if (!data?.flag) throw new Error("Flag was not saved");
      const flag = data.flag;
      setFlags((prev) => [flag, ...prev]);
      setForm({ key: "", label: "", description: "", scope: "global" });
      setShowForm(false);
      await logPlatformEvent({
        action: "Feature flag created", category: "configuration",
        affected_resource: flag.key, details: `Scope: ${flag.scope}`,
      }).catch(() => {});
    } catch {
      setError("Could not create this flag. Check for an existing key and try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (flag, enabled) => {
    if (!WIRED_FLAGS.has(flag.key) || ALWAYS_AVAILABLE.has(flag.key) || RETIRED_FLAGS.has(flag.key)) return;
    if (enabled && NEEDS_EXTERNAL_VERIFICATION.has(flag.key) &&
        !window.confirm("This capability needs live provider or workflow testing before public use. Enable only after reviewing verified results. Continue?")) return;
    if (flag.key === "public_campaign_fundraising" && enabled &&
        !window.confirm("Enable live campaign donations for all eligible published campaigns? Only do this after payment, accounting, and payout verification.")) return;
    setError("");
    setSaving(true);
    try {
      const { data } = await base44.functions.invoke("manageFeatureFlag", { id: flag.id, enabled });
      if (!data?.flag || data.flag.enabled !== enabled) throw new Error("Flag change was not saved");
      setFlags((prev) => prev.map((f) => f.id === flag.id ? { ...f, enabled } : f));
      window.dispatchEvent(new Event("ifund:fundraising-mode-changed"));
      await logPlatformEvent({
        action: `Feature flag ${enabled ? "enabled" : "disabled"}`,
        category: "configuration", affected_resource: flag.key,
        details: "Changed by administrator — reversible at any time.",
      }).catch(() => {});
    } catch {
      setError("Could not change this setting. Its previous state remains in effect.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">The site and published campaigns stay online in both fundraising modes. The Public Campaign Fundraising switch only controls accepting new campaign donations; platform-support donations remain available.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
          <Plus className="w-4 h-4" /> New flag
        </Button>
      )}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="flag_key" />
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Display label" />
          </div>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this flag control?" />
          <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="experiment">Experiment</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={create} disabled={saving || !form.key} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancel</Button>
          </div>
        </div>
      )}

      {flags.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No feature flags configured yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
          {flags.filter(f => f.key !== "stripe_checkout" && f.key !== "recurring_donations").map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-stone-900">{f.label || f.key}</p>
                  <Badge variant="secondary" className="capitalize">{f.scope}</Badge>
                </div>
                <p className="text-xs font-mono text-stone-400 mt-0.5">{f.key}</p>
                {f.description && <p className="text-xs text-stone-500 mt-1">{f.description}</p>}
                {ALWAYS_AVAILABLE.has(f.key) && <p className="text-xs text-emerald-700 mt-1">Always available — not controlled by a feature flag. Financial reconciliation must keep running.</p>}
                {RETIRED_FLAGS.has(f.key) && <p className="text-xs text-amber-700 mt-1">Retired duplicate; do not enable. Use the corrected flag.</p>}
                {!WIRED_FLAGS.has(f.key) && !ALWAYS_AVAILABLE.has(f.key) && !RETIRED_FLAGS.has(f.key) && <p className="text-xs text-amber-700 mt-1">Execution not verified — switch unavailable.</p>}
                {WIRED_FLAGS.has(f.key) && NEEDS_EXTERNAL_VERIFICATION.has(f.key) && <p className="text-xs text-amber-700 mt-1">Code connected; live provider / end-to-end verification required before enabling.</p>}
                {WIRED_FLAGS.has(f.key) && !NEEDS_EXTERNAL_VERIFICATION.has(f.key) && <p className="text-xs text-emerald-700 mt-1">Backend gate connected; functional testing still required before public rollout.</p>}
                {f.key === "public_campaign_fundraising" && <p className="text-xs text-emerald-700 mt-1">{f.enabled ? "Public campaign donations enabled" : "Platform-support-only donations; published campaigns remain online"}</p>}
              </div>
              <Switch checked={f.enabled} disabled={saving || !WIRED_FLAGS.has(f.key) || ALWAYS_AVAILABLE.has(f.key) || RETIRED_FLAGS.has(f.key)} onCheckedChange={(v) => toggle(f, v)} aria-label={`Toggle ${f.label || f.key}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}