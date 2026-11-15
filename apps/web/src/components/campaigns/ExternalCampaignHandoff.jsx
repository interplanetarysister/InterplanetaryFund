import { useState } from "react";
import { buildExternalCampaignKit } from "@/lib/externalCampaignKit";

const destinations = [
  { name: "GoFundMe", href: "https://www.gofundme.com/" },
  { name: "Givebutter", href: "https://givebutter.com/" },
  { name: "FundRazr", href: "https://fundrazr.com/" }
];

export default function ExternalCampaignHandoff({ form, disabled = false }) {
  const [message, setMessage] = useState("");
  const [showKit, setShowKit] = useState(false);
  const kit = buildExternalCampaignKit(form);
  const hasCopy = Boolean(form?.title?.trim() || form?.summary?.trim() || form?.story?.trim());
  async function copyKit() {
    setMessage("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable.");
      await navigator.clipboard.writeText(kit);
      setMessage("Campaign kit copied. Paste it into the host's campaign editor and review it there.");
    } catch {
      setShowKit(true);
      setMessage("Automatic copy unavailable. Select and copy the text below instead.");
    }
  }
  function downloadKit() {
    const blob = new Blob([kit], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ifund-campaign-handoff.txt";
    document.body.appendChild(anchor);
    try { anchor.click(); setMessage("Campaign kit exported to your device. No information was sent to a fundraising platform."); }
    finally { anchor.remove(); URL.revokeObjectURL(url); }
  }
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8" aria-labelledby="external-handoff-title">
    <h2 id="external-handoff-title" className="text-xl font-bold">Take your campaign to another fundraising platform</h2>
    <p className="text-sm text-muted-foreground">Keep the campaign you wrote here, choose an independent fundraising host and publish it there. This export is a text kit, not automatic publishing, a host account connection or proof of partnership.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copyKit} disabled={disabled || !hasCopy} className="min-h-11 rounded-xl border border-border px-4 font-semibold disabled:opacity-50">Copy campaign kit</button>
      <button type="button" onClick={downloadKit} disabled={disabled || !hasCopy} className="min-h-11 rounded-xl border border-border px-4 font-semibold disabled:opacity-50">Download text kit</button>
      <button type="button" onClick={() => setShowKit(value => !value)} className="min-h-11 rounded-xl border border-border px-4 font-semibold" aria-expanded={showKit}>{showKit ? "Hide" : "Preview"} kit</button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    {showKit && <label className="block text-sm font-semibold">Your export text<textarea readOnly rows={12} value={kit} className="mt-2 w-full rounded-xl border border-input bg-background p-3 font-mono text-xs" /></label>}
    <h3 className="font-semibold">Open a fundraising destination</h3>
    <div className="flex flex-wrap gap-3">
      {destinations.map(item => <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold">Visit {item.name} (new tab)</a>)}
    </div>
    <p className="text-sm text-muted-foreground">These are independent destinations, not confirmed iFund partners. Paste your content and upload images manually. Donations, receipts and fees remain entirely with your chosen host; iFund does not collect the host's gifts or apply its first-party withdrawal fee.</p>
  </section>;
}
