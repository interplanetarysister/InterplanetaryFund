import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const CAPABILITY_GROUPS = [
  ["Campaigns and posts", "Create, update, share and manage campaign posts, updates, images, videos and approved publicity."],
  ["Community interactions", "Comment and reply, handle relevant messages and direct-message responses, pages, groups, memberships, invitations and supported interactions."],
  ["Events and streams", "Set up and manage events, livestreams, videos and auctions when the connected service offers those functions."],
  ["Fundraising information", "Read donation information, import or reconcile campaign records, and prepare migration steps where supported."],
  ["Maintenance and insights", "Maintain connections, review engagement and analytics, identify account issues and prepare corrections."]
];
export const ACCOUNT_AI_SCOPE_VERSION = "2026-10-16-account-obo-v1";
const CHOICES = [
 ["full", "Full supported access", "AI can perform the broad set of nonfinancial actions listed below whenever the provider allows them."],
 ["posting", "Posts and outreach", "AI can help with campaigns, posts, images, sharing, comments and basic public interactions."],
 ["read_only", "Read and help me plan", "AI can read supported account information and help plan, but cannot publish or send messages."]
];
export default function AccountAiScope({ platform, checked, onChange, existing = false, scopeChoice = "full", legacyScope = false, onScopeChange, globalEnabled = false, busy = false }) {
  return <section className="rounded-2xl border-2 border-cyan-300 bg-card p-4 space-y-3" aria-label="AI account permissions">
    <h3 className="text-base font-bold flex gap-2 items-center"><ShieldCheck className="w-5 h-5 text-cyan-600" /> AI permissions for {platform.name}</h3>
    <p className="text-sm text-muted-foreground">You decide whether IFund AI can act on this specific account. This is separate from signing in or saving passwords.</p>
    <div className="rounded-xl border border-border p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox id={"connection-ai-" + platform.id} checked={checked} disabled={busy || (!globalEnabled && !checked)} onCheckedChange={value => onChange(value === true)} className="mt-1 shrink-0" />
        <label htmlFor={"connection-ai-" + platform.id} className="text-base font-semibold leading-relaxed cursor-pointer">Allow IFund AI to help connect and use all supported nonfinancial account functions on {platform.name}</label>
      </div>
      <p className="text-sm text-muted-foreground">When on, IFund can perform the selected work below when this provider gives permission. You will not be asked again for routine actions covered by this setting. Provider sign-in, safety checks, and separate money approvals may still be required.</p>
    </div>
    {!globalEnabled && <p className="text-sm text-amber-700 font-semibold">Turn on the one IFund-wide AI switch on the Connections page first. That switch does not automatically turn on a platform you switched off.</p>}
    <div className="rounded-xl border border-border p-3 space-y-2">
      <p className="text-sm font-bold">What AI can do with this account</p>
      {existing
        ? <p className="text-sm">Saved access: {legacyScope ? "Previous connection permissions" : (CHOICES.find(item => item[0] === scopeChoice)?.[1] || "Previously selected access")}. To pick a different scope, disconnect this account, then connect it again.</p>
        : <div role="group" aria-label="Choose AI access scope" className="space-y-2">
          {CHOICES.map(([value, title, description]) => <label key={value} className="flex gap-3 border border-border rounded-lg p-3 cursor-pointer">
            <input className="h-5 w-5 shrink-0" type="radio" name={"scope-" + platform.id} value={value} checked={scopeChoice === value} onChange={() => onScopeChange?.(value)} />
            <span className="text-sm"><strong>{title}</strong><span className="block text-muted-foreground mt-1">{description}</span></span>
          </label>)}
        </div>}
    </div>
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-bold">See all requested AI activity categories</summary>
      <ul className="mt-3 space-y-3">
        {CAPABILITY_GROUPS.map(([heading, description]) => <li key={heading} className="text-sm"><strong>{heading}:</strong> {description}</li>)}
      </ul>
      <p className="text-sm font-semibold mt-3">Not included: withdrawals, moving or transferring donations or funds, spending, purchases, financial payouts, or bypassing provider security. Financial migrations require separate approval for each monetary action.</p>
    </details>
    <p className="text-sm text-muted-foreground">{existing ? "You can turn AI off now, without disconnecting. Changing its allowed scope takes a new connection." : "AI starts off. Turn it on if you want help, or connect without AI."} You can also revoke permission on the provider's site.</p>
    <Link to="/help/ai-platform-permissions" className="text-sm underline text-primary font-semibold">How AI permission works</Link>
  </section>;
}
