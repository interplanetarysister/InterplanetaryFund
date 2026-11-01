import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { buildCoverPrompt } from "@/lib/coverPrompt";
import { brandAndUploadGeneratedImage } from "@/lib/ifundImageBranding";
import { resolveGeneratedImageUrl } from "@/lib/generatedMedia";
import { COMPLIANCE_RULES } from "@/lib/campaignAI";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export default function AIImageStudio() {
  const enabled = useFeatureEnabled("ai_campaign_assistant");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("environment");
  const [description, setDescription] = useState("");
  const [variation, setVariation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const generate = async () => {
    if (busy || !title.trim() || !description.trim()) return;
    setBusy(true);
    setError("");
    try {
      const prompt = buildCoverPrompt({ title, category, story: description + "\n" + COMPLIANCE_RULES, regenCount: variation });
      const response = await base44.functions.invoke("generateCampaignCover", { prompt });
      const url = resolveGeneratedImageUrl(response?.data);
      if (!url) throw new Error("The AI generator did not return an image.");
      const uploaded = await brandAndUploadGeneratedImage(base44, url);
      setImage(uploaded);
      setVariation(v => v + 1);
    } catch (err) {
      setError("The image could not be generated or saved. Please try again. Your previous image is preserved.");
    } finally {
      setBusy(false);
    }
  };
  return <main className="mx-auto w-full max-w-3xl space-y-5 px-3 py-6 text-white">
    <h1 className="text-2xl font-bold">IFund AI Image Studio</h1>
    <p className="text-slate-300">Create original images with IFund's interplanetary space-comic, cyberpunk and restrained steampunk art direction. The server applies the official IFund signature instructions automatically. Generated images are checked, branded according to your plan and uploaded before display.</p>
    <div className="space-y-2"><Label htmlFor="studio-title">What is the image for?</Label><Input id="studio-title" className="text-slate-900" value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder="e.g. Cannon Beach cleanup" /></div>
    <div className="space-y-2"><Label htmlFor="studio-category">Campaign category</Label><select id="studio-category" className="w-full rounded-md border border-slate-400 bg-slate-950 p-3 text-white" value={category} onChange={e=>setCategory(e.target.value)}>{["environment","community","animals","medical","education","emergency","disaster_relief","business","creative","memorial","other"].map(c=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="studio-description">Describe the image and its real purpose</Label><Textarea id="studio-description" className="min-h-32 text-slate-900" value={description} onChange={e=>setDescription(e.target.value)} maxLength={4000} placeholder="What should the art represent? Only include true campaign details." /></div>
    <Button type="button" onClick={generate} disabled={busy || !enabled || !title.trim() || !description.trim()}>{busy ? "Generating and saving…" : image ? "Generate another variation" : "Generate IFund image"}</Button>
    {!enabled && <p className="text-amber-200">AI image generation is unavailable for this account or plan.</p>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {image && <section className="space-y-3"><img src={image} alt={"AI generated IFund artwork for " + title} className="w-full rounded-xl border border-cyan-300/40" /><a href={image} target="_blank" rel="noopener noreferrer" className="inline-block underline text-cyan-200">Open saved image</a><p className="text-sm text-slate-300">Choose where to share this image. The social composer lets you write a caption, choose an associated campaign, and select authorized external destinations.</p><Link to="/social" state={{ ifundImageStudio: { mediaUrl: image, content: title } }} className="inline-block rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white">Share to IFund and connected platforms</Link><p className="text-xs text-slate-300">External publishing is attempted only for selected, working connections. Unsupported destinations may require manual sharing.</p><Link className="block underline text-cyan-200" to="/create">Open campaign editor</Link></section>}
  </main>;
}
