import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Code2, QrCode, Download, Image as ImageIcon } from "lucide-react";
import html2canvas from "html2canvas";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import { buildCampaignEmbed } from "@/lib/campaignSharing";
import { copyText } from "@/lib/copyText";

// Both embed snippets are always visible, selectable, and copyable even when
// mobile browsers block clipboard permissions. Never put preview/editor URLs
// in code pasted outside IFund: use the canonical public domain.
export default function ShareCampaignKit({ campaign }) {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const [copied, setCopied] = useState("");
  const [warning, setWarning] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const cardRef = useRef(null);
  const imageCardRef = useRef(null);
  const buttonRef = useRef(null);
  const linkRef = useRef(null);
  const embed = buildCampaignEmbed(campaign, platformOnlyMode);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=${encodeURIComponent(embed.url)}`;
  const shareCaption = [
    campaign.title || "Support this campaign",
    campaign.summary || "",
    embed.url,
  ].filter(Boolean).join("\n\n");

  const copy = async (which, text, ref) => {
    const success = await copyText(text, ref?.current);
    setCopied(success ? which : "");
    setWarning(success ? "" : "Clipboard access is unavailable. Select the text above and use Copy.");
    if (success) setTimeout(() => setCopied(""), 2200);
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: campaign.title || "Campaign", url: embed.url }); return; }
      catch { /* user canceled or native share unavailable */ }
    }
    await copy("link", embed.url, linkRef);
  };
  const renderShareImage = async () => {
    if (!imageCardRef.current) throw new Error("Campaign card is not ready");
    const canvas = await html2canvas(imageCardRef.current, {
      backgroundColor: "#ffffff", scale: 3, useCORS: true, allowTaint: false,
      imageTimeout: 12000, logging: false,
    });
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png"));
  };
  const downloadShareImage = async (blob) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${(campaign.title || "ifund-campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ifund-campaign"}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };
  const exportImage = async (action) => {
    setImageBusy(true);
    setWarning("");
    try {
      const blob = await renderShareImage();
      if (action === "copy") {
        if (navigator.clipboard?.write && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopied("image");
          setTimeout(() => setCopied(""), 2200);
        } else {
          await downloadShareImage(blob);
          setWarning("This browser cannot copy images directly, so the PNG was downloaded. Attach it to email or upload it to your post.");
        }
      } else if (action === "share" && navigator.share && window.File) {
        const file = new File([blob], "ifund-campaign.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          try { await navigator.share({ files: [file], title: campaign.title || "IFund campaign", text: shareCaption }); }
          catch (error) {
            if (error?.name !== "AbortError") {
              await downloadShareImage(blob);
              setWarning("Image sharing is unavailable here, so the PNG was downloaded instead.");
            }
          }
        } else {
          await downloadShareImage(blob);
          setWarning("Image sharing is unavailable here, so the PNG was downloaded instead.");
        }
      } else {
        await downloadShareImage(blob);
        if (action === "share") setWarning("This device cannot share image files directly, so the PNG was downloaded.");
      }
    } catch {
      setWarning("Could not create the campaign image. Try again or use the campaign link and HTML below.");
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm" aria-label="Share and embed campaign">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-1">
        <Share2 className="w-4 h-4 text-primary" /> Share & embed campaign
      </h3>
      <p className="text-xs text-stone-500 mb-4">
        {platformOnlyMode ? "Your campaign stays public and shareable. Individual campaign donations are currently paused." :
          "Copy a permanent IFund link or paste the campaign card into a website, blog or profile."}
      </p>

      <label htmlFor="ifund-campaign-link" className="block text-xs font-semibold text-stone-700 mb-1">Permanent campaign link</label>
      <textarea id="ifund-campaign-link" ref={linkRef} readOnly value={embed.url}
        onFocus={e => e.target.select()} rows={2}
        className="w-full rounded-lg border border-stone-300 bg-slate-50 p-3 text-sm text-slate-900 break-all resize-y" />
      <div className="flex flex-wrap gap-2 mt-2 mb-4">
        <Button type="button" variant="outline" size="sm" onClick={() => copy("link", embed.url, linkRef)}>
          {copied === "link" ? <Check /> : <Copy />} {copied === "link" ? "Link copied" : "Copy link"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={share}><Share2 /> Share</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => {
          window.location.assign("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(embed.url));
        }}>Share on Facebook</Button>
        <Button type="button" variant="outline" size="sm" disabled={imageBusy} onClick={() => exportImage("share")}>
          <ImageIcon /> Share image to Instagram
        </Button>
      </div>

      <label htmlFor="ifund-campaign-card-code" className="block text-xs font-semibold text-stone-700 mb-1">Embed campaign card — copy all HTML</label>
      <textarea id="ifund-campaign-card-code" ref={cardRef} readOnly rows={6}
        value={embed.card} onFocus={e => e.target.select()}
        className="w-full rounded-lg border border-stone-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 resize-y" />
      <Button type="button" variant="outline" size="sm" className="w-full mt-2 rounded-xl"
        onClick={() => copy("card", embed.card, cardRef)}>
        {copied === "card" ? <Check /> : <Code2 />} {copied === "card" ? "Card HTML copied" : "Copy campaign card HTML"}
      </Button>

      <div className="rounded-xl bg-slate-50 border border-stone-200 p-3 mt-4 flex justify-center">
        <a ref={imageCardRef} href={embed.url} target="_blank" rel="noopener noreferrer"
          aria-label={`Open the campaign: ${campaign.title || "Campaign"}`}
          className="block w-full max-w-[320px] rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-lg text-stone-900 hover:shadow-xl">
          <img src={embed.previewImage} alt={campaign.title || "Campaign image"}
            loading="lazy" className="h-40 w-full object-cover" />
          <div className="p-4 space-y-2">
            <h4 className="font-display text-lg font-bold break-words">{campaign.title || "Campaign"}</h4>
            {campaign.summary && <p className="text-xs text-stone-500 line-clamp-3">{campaign.summary}</p>}
            <p className="text-xs text-slate-700">{(Number(campaign.raised_amount) || 0).toLocaleString("en-US", {style:"currency",currency:"USD"})} raised</p>
            <span className="block rounded-lg bg-blue-600 p-3 text-center text-sm font-semibold text-white">
              {platformOnlyMode ? "View campaign" : "Support campaign"}
            </span>
          </div>
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        <Button type="button" variant="outline" size="sm" disabled={imageBusy} onClick={() => exportImage("copy")}>
          {copied === "image" ? <Check /> : <Copy />} {copied === "image" ? "Image copied" : "Copy image"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={imageBusy} onClick={() => exportImage("download")}>
          <Download /> Download PNG
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={imageBusy} onClick={() => exportImage("share")}>
          <ImageIcon /> Share image
        </Button>
      </div>
      {imageBusy && <p role="status" className="text-xs text-stone-500 mt-2">Preparing campaign image…</p>}
      <p className="text-[11px] text-stone-500 mt-2">
        Copy the image where supported, or download the PNG to attach to email or upload to social platforms. The caption below includes the clickable campaign link.
      </p>
      <label htmlFor="ifund-campaign-caption" className="block text-xs font-semibold text-stone-700 mt-4 mb-1">Email and social caption</label>
      <textarea id="ifund-campaign-caption" readOnly rows={4} value={shareCaption}
        onFocus={e => e.target.select()}
        className="w-full rounded-lg border border-stone-300 bg-slate-50 p-3 text-sm text-slate-900 resize-y" />
      <Button type="button" variant="outline" size="sm" className="w-full mt-2"
        onClick={() => copy("caption", shareCaption, null)}>
        {copied === "caption" ? <Check /> : <Copy />} {copied === "caption" ? "Caption copied" : "Copy caption + link"}
      </Button>
      <p className="text-[11px] text-stone-500 mt-2">
        The website embed works on platforms that allow custom HTML. It shows a progress snapshot; clicking opens current details on IFund.
      </p>

      <label htmlFor="ifund-campaign-button-code" className="block text-xs font-semibold text-stone-700 mt-4 mb-1">Embed a smaller campaign button</label>
      <textarea id="ifund-campaign-button-code" ref={buttonRef} readOnly rows={4}
        value={embed.button} onFocus={e => e.target.select()}
        className="w-full rounded-lg border border-stone-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 resize-y" />
      <Button type="button" variant="outline" size="sm" className="w-full mt-2"
        onClick={() => copy("button", embed.button, buttonRef)}>
        {copied === "button" ? <Check /> : <Code2 />} {copied === "button" ? "Button HTML copied" : "Copy button HTML"}
      </Button>
      {warning && <p role="status" className="text-sm text-amber-700 mt-3">{warning}</p>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <img src={qrSrc} alt="QR code linking to this campaign" className="w-28 h-28 rounded-lg border border-stone-200" />
        <a href={qrSrc} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-700 underline">
          <Download className="w-4 h-4" /> Open QR code <QrCode className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}
