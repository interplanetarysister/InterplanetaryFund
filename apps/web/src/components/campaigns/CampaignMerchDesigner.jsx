import { useEffect, useMemo, useState } from "react";
import {
  MERCH_DESIGN_OPTIONS, validateMerchDesignRequest,
} from "@/lib/campaignMerch.mjs";
import { Download, ImagePlus, ShieldCheck, Sparkles, ShoppingBag } from "lucide-react";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function fitCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  ctx.drawImage(image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth, sourceHeight, x, y, width, height);
}
function makeArtworkCanvas({ designId, image, name, title }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600; canvas.height = 1920;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Your browser cannot render a merchandise proof.");
  const gradient = ctx.createLinearGradient(0, 0, 1600, 1920);
  if (designId === "orbit-portrait") {
    gradient.addColorStop(0, "#080f25"); gradient.addColorStop(1, "#361458");
  } else if (designId === "horizon-story") {
    gradient.addColorStop(0, "#10293d"); gradient.addColorStop(1, "#271643");
  } else {
    gradient.addColorStop(0, "#0b1f25"); gradient.addColorStop(1, "#112b33");
  }
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.roundRect(80, 90, 1440, 1750, 100); ctx.fill();
  ctx.save();
  if (designId === "orbit-portrait") {
    ctx.beginPath(); ctx.arc(800, 785, 555, 0, Math.PI * 2); ctx.clip();
    fitCover(ctx, image, 245, 230, 1110, 1110);
  } else if (designId === "horizon-story") {
    ctx.beginPath(); ctx.roundRect(170, 250, 1260, 1010, 55); ctx.clip();
    fitCover(ctx, image, 170, 250, 1260, 1010);
  } else {
    ctx.beginPath(); ctx.roundRect(275, 285, 1050, 975, 180); ctx.clip();
    fitCover(ctx, image, 275, 285, 1050, 975);
  }
  ctx.restore();
  const accent = MERCH_DESIGN_OPTIONS.find(opt => opt.id === designId)?.accent || "#52dfe8";
  ctx.strokeStyle = accent; ctx.lineWidth = 18;
  if (designId === "orbit-portrait") {
    ctx.beginPath(); ctx.ellipse(800, 785, 595, 520, -Math.PI / 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(800, 785, 555, 595, Math.PI / 7, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(180, 1320); ctx.quadraticCurveTo(790, 1090, 1420, 1320); ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.shadowColor = "#02020b"; ctx.shadowBlur = 16;
  ctx.fillStyle = "#fff";
  ctx.font = "700 107px sans-serif";
  ctx.fillText(name, 800, 1530, 1270);
  ctx.font = "500 48px sans-serif";
  ctx.fillStyle = "#d2e8f3";
  ctx.fillText(title || "A mission worth supporting", 800, 1635, 1220);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = accent; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(365, 1712); ctx.lineTo(1235, 1712); ctx.stroke();
  ctx.fillStyle = accent; ctx.font = "600 33px sans-serif";
  ctx.fillText("SUPPORTED THROUGH INTERPLANETARY FUND", 800, 1782, 1080);
  return canvas;
}
function loadProofImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That campaign image cannot be exported. Upload an original photo or permitted copy instead."));
    image.src = url;
  });
}
export default function CampaignMerchDesigner({ campaigns = [] }) {
  const [campaignId, setCampaignId] = useState("");
  const [name, setName] = useState("");
  const [designId, setDesignId] = useState(MERCH_DESIGN_OPTIONS[0].id);
  const [approvedName, setApprovedName] = useState(false);
  const [approvedArtwork, setApprovedArtwork] = useState(false);
  const [file, setFile] = useState(null);
  const [localUrl, setLocalUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const selected = useMemo(
    () => campaigns.find(item => item?.id === campaignId) || null,
    [campaignId, campaigns],
  );
  useEffect(() => {
    if (!file) { setLocalUrl(""); return; }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const sourceImage = localUrl || selected?.cover_image_url || "";
  const valid = validateMerchDesignRequest({
    beneficiaryName: name, designId,
    namePublicationApproved: approvedName, artworkRightsConfirmed: approvedArtwork,
  });
  async function downloadProof() {
    if (busy) return;
    if (!selected) { setStatus("Choose one of your own saved campaigns."); return; }
    if (!valid.ok) { setStatus(valid.error); return; }
    if (!sourceImage) { setStatus("Add campaign artwork before preparing a merchandise proof."); return; }
    setBusy(true); setStatus("");
    try {
      const image = await loadProofImage(sourceImage);
      const canvas = makeArtworkCanvas({
        designId, image, name: valid.beneficiaryName,
        title: String(selected.title || "").slice(0, 150),
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The PNG proof could not be created.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ifund-" + designId + "-proof.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus("Artwork proof prepared. No Printful order or store listing was created.");
    } catch (error) {
      setStatus(error?.message || "Artwork proof could not be created.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="campaign-merch-studio" className="ifund-merch-studio rounded-3xl border border-cyan-300/25 p-5 sm:p-8 space-y-5 scroll-mt-24" aria-label="iFund campaign merchandise designer">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">iFund Shop to Support</p>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingBag className="w-6 h-6"/> Your campaign. One meaningful item.</h2>
          <p className="text-sm text-slate-200">Choose a campaign and one of three themed artworks. iFund will manage production and shipping once the Printful merchant connection has been verified.</p>
        </div>
        <span className="rounded-full border border-amber-300/30 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">Fulfillment setup pending</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-100">Your saved campaign
          <select className="mt-2 w-full min-h-12 rounded-xl bg-slate-950/70 border border-cyan-300/25 p-3 text-white"
            value={campaignId} onChange={e => {setCampaignId(e.target.value); setFile(null); setStatus("");}}>
            <option value="">Choose a campaign</option>
            {campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title || "Untitled campaign"}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-100">Beneficiary's approved display name
          <input className="mt-2 w-full min-h-12 rounded-xl bg-slate-950/70 border border-cyan-300/25 p-3 text-white"
            maxLength={72} value={name} onChange={e => setName(e.target.value)} placeholder="Name to print on the item"/>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {MERCH_DESIGN_OPTIONS.map(option => (
          <button key={option.id} type="button" aria-pressed={designId === option.id}
            onClick={() => {setDesignId(option.id); setStatus("");}}
            className={"ifund-merch-design text-left rounded-2xl border p-3 space-y-2 min-h-48 " +
              (designId === option.id ? "border-cyan-300 ring-2 ring-cyan-300/30" : "border-slate-400/25")}>
            <div className={"ifund-merch-preview ifund-merch-preview--"+option.id}>
              {sourceImage ? <img src={sourceImage} alt={"Selected campaign artwork in "+option.label+" preview"} /> : <ImagePlus className="h-10 w-10 text-white/70"/>}
              <span>{name.trim() || "Beneficiary name"}</span>
            </div>
            <p className="font-semibold text-white">{option.label}</p>
            <p className="text-xs text-slate-200">{option.description}</p>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-100 cursor-pointer">
        <ImagePlus className="w-5 h-5 text-cyan-200 shrink-0"/>
        <span className="flex-1">Use my own authorized campaign photo (optional replacement for the cover)</span>
        <input type="file" accept="image/jpeg,image/png" className="max-w-[175px] text-xs"
          onChange={e => {
            const next=e.target.files?.[0];
            if (!next) {setFile(null);return;}
            if (!["image/png","image/jpeg"].includes(next.type) || next.size > MAX_IMAGE_SIZE) {
              setStatus("Choose a JPEG or PNG smaller than 5 MB.");setFile(null);return;
            }
            setFile(next);setStatus("");
          }}/>
      </label>
      <div className="space-y-3 rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-100"><input type="checkbox" className="mt-1 h-4 w-4" checked={approvedName} onChange={e=>setApprovedName(e.target.checked)}/><span>I have permission to display this beneficiary's name on merchandise, including any necessary guardian consent.</span></label>
        <label className="flex items-start gap-3 text-sm text-slate-100"><input type="checkbox" className="mt-1 h-4 w-4" checked={approvedArtwork} onChange={e=>setApprovedArtwork(e.target.checked)}/><span>I have the rights to use the selected campaign imagery for printed merchandise.</span></label>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" disabled={busy || !selected} onClick={downloadProof}
          className="ifund-action inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">
          {busy ? <Sparkles className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {busy ? "Preparing artwork..." : "Create selected design proof"}
        </button>
        <span className="inline-flex gap-2 items-center text-xs text-slate-200"><ShieldCheck className="w-4 h-4" /> 50% of cleared net merchandise profit goes to the campaign; 50% supports iFund.</span>
      </div>
      <p className="text-xs text-slate-300">This creates a design proof only, not a print-production file or a live shop listing. Product dimensions, mockups, price, checkout, and fulfillment require verified Printful integration and owner approval. No donation balance changes.</p>
      {status && <p className="rounded-lg border border-cyan-300/20 bg-slate-950/40 p-3 text-sm text-white" role="status">{status}</p>}
    </section>
  );
}
