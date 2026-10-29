import { useState } from "react";
import { Link } from "react-router-dom";
import { campaignPublicUrl, campaignEmbedCode } from "@/lib/campaignSharing";

export default function CampaignShareTools({ campaign }) {
  const [status, setStatus] = useState("");
  const [showEmbed, setShowEmbed] = useState(false);
  if (!campaign?.id || campaign.status !== "active") return null;

  const publicUrl = campaignPublicUrl(window.location.origin, campaign.id);
  const embed = campaignEmbedCode(window.location.origin, campaign.id);
  async function copy(value, label) {
    try {
      if (!navigator.clipboard?.writeText) throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setStatus(label + " copied.");
    } catch {
      setStatus("Copy is unavailable on this device. Select the address below manually.");
      setShowEmbed(label === "Embed code");
    }
  }
  async function share() {
    setStatus("");
    if (!navigator.share) return copy(publicUrl, "Campaign link");
    try {
      await navigator.share({ title: campaign.title, text: campaign.summary || campaign.title, url: publicUrl });
      setStatus("Share menu opened.");
    } catch (cause) {
      if (cause?.name !== "AbortError") setStatus("Unable to open share menu. You can copy the link instead.");
    }
  }
  return <section aria-labelledby="campaign-sharing-title" className="rounded-2xl border border-border bg-card p-5">
    <h2 id="campaign-sharing-title" className="text-lg font-semibold">Share this campaign</h2>
    <p className="mt-1 text-sm text-muted-foreground">Share the verified campaign page. Donations are still paused.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={share} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Share</button>
      <button type="button" onClick={() => copy(publicUrl, "Campaign link")} className="rounded-xl border border-border px-4 py-2 font-semibold">Copy link</button>
      <button type="button" onClick={() => { setShowEmbed(current => !current); setStatus(""); }} className="rounded-xl border border-border px-4 py-2 font-semibold">
        {showEmbed ? "Hide embed" : "Embed card"}
      </button>
    </div>
    <label className="mt-4 block text-xs text-muted-foreground">Campaign address
      <input readOnly aria-label="Campaign address" value={publicUrl} onFocus={event => event.target.select()} className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
    </label>
    {showEmbed && <div className="mt-4">
      <p className="mb-2 text-sm">Add this read-only campaign card to your website. Payments never run inside this iframe.</p>
      <textarea readOnly aria-label="Campaign embed HTML" value={embed} rows={4} onFocus={event => event.target.select()} className="w-full rounded-lg border border-input bg-background p-3 text-xs" />
      <button type="button" onClick={() => copy(embed, "Embed code")} className="mt-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Copy embed code</button>
    </div>}
    {status && <p role="status" className="mt-2 text-sm">{status}</p>}
    <p className="mt-3 text-xs text-muted-foreground">Privacy and permissions apply to the public page. <Link to="/help" className="underline">Help</Link></p>
  </section>;
}
