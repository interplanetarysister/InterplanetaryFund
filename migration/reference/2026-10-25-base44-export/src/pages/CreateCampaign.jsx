import CampaignVoiceAssistant from '@/components/campaigns/CampaignVoiceAssistant';
import { externalCampaignAssistantEnabled, invokeCampaignAssistant } from '@/lib/campaignAssistantProvider';
import { buildCampaignContext } from '@/lib/campaignAI';
import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image } from "@/components/ui/image";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import { useToast } from "@/components/ui/use-toast";
import AIInstructionsStep, { emptyAiProfile } from "@/components/campaigns/AIInstructionsStep";
import AIStoryGenerator from "@/components/campaigns/AIStoryGenerator";
import CampaignCopyChoices from "@/components/campaigns/CampaignCopyChoices";
import MediaUpload from "@/components/media/MediaUpload";
import { resolveGeneratedImageUrl } from "@/lib/generatedMedia";
import { brandAndUploadGeneratedImage } from "@/lib/ifundImageBranding";
import { buildCoverPrompt } from "@/lib/coverPrompt";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, MapPin, Rocket, Coins, Wand2, Download, Wallet, UserRound, Target, BookOpen, Check } from "lucide-react";

const steps = [
  { label: "Your Details", icon: UserRound },
  { label: "Basics", icon: Target },
  { label: "Your Story", icon: BookOpen },
  { label: "Launch", icon: Rocket },
];

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const importConnectionId = searchParams.get("import_connection");
  const voiceMode = searchParams.get("voice") === "1";
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const savingRef = useRef(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [regenCount, setRegenCount] = useState(0);
  const [form, setForm] = useState({
    title: "", category: "other", goal_amount: "", end_date: "",
    summary: "", story: "", cover_image_url: "", cover_image_is_ai: false,
    location: "", location_lat: null, location_lng: null,
    ai_profile: emptyAiProfile, story_versions: [], accept_crypto_donations: false,
  });
  const [locating, setLocating] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(!!draftId);
  const [importing, setImporting] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await base44.functions.invoke("getCampaignDraft", { campaign_id: draftId });
        const draft = data?.ok === true ? data.campaign : null;
        if (!draft || draft.status !== "draft") throw new Error("Draft unavailable");
        if (!cancelled) setForm({
          title: draft.title || "", category: draft.category || "other", goal_amount: draft.goal_amount > 0 ? draft.goal_amount : "", end_date: draft.end_date || "",
          summary: draft.summary || "", story: draft.story || "", cover_image_url: draft.cover_image_url || "", cover_image_is_ai: draft.cover_image_is_ai === true,
          location: draft.location || "", location_lat: draft.location_lat ?? null, location_lng: draft.location_lng ?? null,
          ai_profile: { ...emptyAiProfile, ...(draft.ai_profile || {}) }, story_versions: draft.story_versions || [],
          accept_crypto_donations: draft.accept_crypto_donations === true,
        });
        if (!cancelled) setStep(Math.min(3, Math.max(0, Number(draft.draft_step) || 0)));
      } catch {
        if (!cancelled) toast({ title: "Couldn't reopen that draft", description: "It may have been removed or you may not have access.", variant: "destructive" });
      } finally { if (!cancelled) setLoadingDraft(false); }
    })();
    return () => { cancelled = true; };
  }, [draftId]);

  const importConnectedCampaign = async () => {
    if (!importConnectionId) return;
    const goal = Number(form.goal_amount);
    if (!(Number.isFinite(goal) && goal > 0)) {
      setStep(1);
      toast({ title: "Enter a campaign goal", description: "Add your goal, then import the connected fundraiser.", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const requestId = crypto.randomUUID();
      const { data } = await base44.functions.invoke("importExternalCampaign", { connection_id: importConnectionId, campaign: { goal_amount: goal }, request_id: requestId });
      if (!data?.campaign_id && !data?.campaign?.id) throw new Error("Import failed");
      navigate(`/create?draft=${data.campaign_id || data.campaign.id}`, { replace: true });
    } catch {
      toast({ title: "Couldn't import campaign", description: "The connected platform could not populate this campaign yet.", variant: "destructive" });
    } finally { setImporting(false); }
  };

  const locate = async () => {
    if (!form.location) return;
    setLocating(true);
    try {
      const res = await base44.functions.invoke("geocodeCity", { city: form.location });
      if (res.error || res.data?.error) throw new Error("Geocoding request rejected");
      setForm((f) => ({ ...f, location_lat: res.data.lat, location_lng: res.data.lng }));
      toast({ title: "Location found", description: (res.data.display || form.location).split(",")[0] });
    } catch {
      setForm((f) => ({ ...f, location_lat: null, location_lng: null }));
      toast({ title: "Couldn't find that city", description: "Check the city name and try again.", variant: "destructive" });
    }
    setLocating(false);
  };

  const generateCover = async () => {
    setGeneratingImage(true);
    // Generate actual AI art using the campaign context and IFund signature style.
    try {
      const prompt = buildCoverPrompt({ title: form.title, category: form.category, story: buildCampaignContext(form, form.ai_profile), regenCount });
      const res = externalCampaignAssistantEnabled
        ? { data: await invokeCampaignAssistant({ kind: 'image', campaign: form, regenCount }) }
        : await base44.functions.invoke("generateCampaignCover", { prompt });
      const url = resolveGeneratedImageUrl(res?.data);
      if (!url) throw new Error("Generator returned no image URL");
      const brandedUrl = await brandAndUploadGeneratedImage(base44, url);
      setForm((current) => ({ ...current, cover_image_url: brandedUrl, cover_image_is_ai: true }));
      setRegenCount((c) => c + 1);
      toast({ title: "Cover created", description: "Your AI-generated illustration is ready and visible below." });
      return true;
    } catch {
      // Never represent a placeholder as a successful generated image.
      // Preserve the old cover if the provider failed or the file does not load.
      toast({ title: "Image could not be displayed", description: "The generated file did not load. Your previous image is unchanged. Try again or upload your own photo.", variant: "destructive" });
      return false;
    } finally {
      setGeneratingImage(false);
    }
  };

  const saveError = (error, fallback) => {
    const detail = error?.response?.data?.error || error?.data?.error || error?.message;
    const message = typeof detail === "string" ? detail.trim() : "";
    if (/sign in|unauthorized|401|authentication/i.test(message)) return "Your session expired. Sign in again, then retry.";
    if (/not authorized|403|permission/i.test(message)) return "This account cannot change that campaign.";
    if (/network|fetch|timeout|cors/i.test(message)) return "Unable to reach the campaign server. Check your connection and try again.";
    return message && !/internal server error|stack|trace/i.test(message) ? message.slice(0, 220) : fallback;
  };

  const saveDraft = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setDraftNotice("");
    try {
      const { data } = await base44.functions.invoke("saveCampaign", {
        campaign_id: draftId || undefined,
        campaign: {
          ...form,
          goal_amount: form.goal_amount === "" ? 0 : Number(form.goal_amount),
          status: "draft",
          draft_step: step,
          end_date: form.end_date || undefined,
          location_lat: form.location_lat ?? undefined,
          location_lng: form.location_lng ?? undefined,
        },
      });
      if (data?.ok !== true || !data?.campaign?.id) throw new Error("Draft save rejected");
      // Keep the creator on the same step, with the same fields visible.
      if (!draftId) navigate(`/create?draft=${encodeURIComponent(data.campaign.id)}${voiceMode ? "&voice=1" : ""}`, { replace: true });
      setDraftNotice("Draft saved. Your progress is private and you can continue later.");
      toast({ title: "Draft saved", description: "All your current work is saved." });
      return data.campaign.id;
    } catch (error) {
      const reason = saveError(error, "The campaign service could not save this draft. Try again.");
      setDraftNotice(`Draft not saved: ${reason}`);
      toast({ title: "Draft not saved", description: reason, variant: "destructive" });
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const launch = async (status) => {
    if (status === "draft") return saveDraft();
    if (status === "active") {
      const missing = [];
      if (!form.title?.trim()) missing.push("title");
      if (!form.story?.trim() && !form.summary?.trim()) missing.push("campaign story");
      // A custom cover is optional. IFund has a safe default image.
      // End date is optional during creation; campaigns can launch without one.
      if (!(parseFloat(form.goal_amount) > 0)) missing.push("goal amount");
      if (missing.length) {
        toast({ title: "Campaign isn't ready to launch", description: `Please add: ${missing.join(", ")}.`, variant: "destructive" });
        return;
      }
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setDraftNotice("");
    try {
      const payload = {
        ...form,
        // Summary is optional. If the creator leaves it blank, derive the public
        // short summary from the authoritative story instead of blocking launch.
        summary: form.summary?.trim() || form.story?.trim().replace(/\s+/g, " ").slice(0, 220) || "",
        goal_amount: parseFloat(form.goal_amount),
        end_date: form.end_date || undefined,
        location: form.location || undefined,
        location_lat: form.location_lat || undefined,
        location_lng: form.location_lng || undefined,
        status,
        draft_step: step,
      };
      const { data } = await base44.functions.invoke("saveCampaign", { campaign_id: draftId || undefined, campaign: payload });
      if (data?.ok !== true || !data?.campaign?.id) throw new Error("Campaign save rejected");
      const campaign = data.campaign;
      if (data.created === true) base44.functions.invoke("recordCampaignCreated", { campaign_id: campaign.id }).catch(() => {});
      navigate(`/campaign/${campaign.id}`);
    } catch (error) {
      const reason = saveError(error, "Please try again. If the problem continues, contact support.");
      setDraftNotice(`Campaign not published: ${reason}`);
      toast({ title: "Couldn't launch campaign", description: reason, variant: "destructive" });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const canNext = step === 0 ? true : step === 1 ? parseFloat(form.goal_amount) > 0 : step === 2 ? Boolean(form.title?.trim()) : true;

  if (loadingDraft) return <div className="campaign-quest deep-space max-w-3xl mx-auto my-6 min-h-64 rounded-[2rem] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-cyan-300" /></div>;

  return (
    <div className="campaign-quest deep-space max-w-3xl mx-auto w-full min-w-0 px-4 sm:px-6 py-8 sm:py-12 overflow-x-hidden rounded-[2rem] sm:my-6">
      <div className="mb-5"><Button type="button" variant="outline" onClick={() => { const next = new URLSearchParams(searchParams); if (voiceMode) next.delete('voice'); else next.set('voice','1'); navigate(`/create?${next.toString()}`, {replace:true}); }}>{voiceMode ? 'Close voice assistant' : 'Create by voice · Alexa+ simulation'}</Button></div>
      {voiceMode && <div className="mb-6"><CampaignVoiceAssistant form={form} onPatch={(patch) => setForm((current) => ({...current,...patch}))} onGenerateImage={generateCover} onSave={saveDraft} saving={saving} /></div>}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3 mb-8 min-w-0" role="list" aria-label={`Campaign setup: step ${step + 1} of ${steps.length}`}>
        {steps.map(({ label, icon: StepIcon }, i) => (
          <div key={label} role="listitem" aria-current={i === step ? "step" : undefined}
               className={`flex flex-col items-center gap-2 text-center min-w-0 ${i <= step ? "text-cyan-100" : "text-slate-400"}`}>
            <span className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border ${i < step ? "bg-cyan-400 text-slate-950 border-cyan-200" : i === step ? "bg-violet-500 text-white border-violet-300 shadow-[0_0_18px_rgba(139,92,246,.4)]" : "bg-slate-900 text-slate-400 border-slate-700"}`}>
              {i < step ? <Check className="w-6 h-6" strokeWidth={2.5} /> : <StepIcon className="w-6 h-6" strokeWidth={2} />}
            </span>
            <span className="text-[11px] leading-tight sm:text-sm font-semibold break-words">{label}</span>
          </div>
        ))}
      </div>

      <h1 className="font-display text-3xl sm:text-4xl brand-gradient-text mb-2 break-words">
        {step === 0 && "Tell us what matters"}{step === 1 && "Set the campaign basics"}{step === 2 && "Choose your words and story"}{step === 3 && "Review & launch"}
      </h1>
      <p className="text-sm text-slate-300 mb-6">{step === 0 ? "Give your campaign a spark. The AI can handle the complicated stuff." : step === 1 ? "Just the essentials. You can fine-tune the rest later." : step === 2 ? "Pick a title, pick a description, then create your story—all on this page." : "One last look before your campaign enters orbit."}</p>
      {importConnectionId && !draftId && <Button type="button" onClick={importConnectedCampaign} disabled={importing} variant="outline" className="quest-button mb-4">{importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}Import from connected fundraiser</Button>}

      <div className="glass-panel rounded-[1.75rem] p-4 sm:p-6 shadow-[0_20px_70px_rgba(2,6,23,.45)] space-y-5 min-w-0">
        {step === 0 && <AIInstructionsStep value={form.ai_profile} onChange={(p) => set("ai_profile", p)} />}

        {step === 1 && (<div className="space-y-5">
          <div className="flex items-center gap-3"><span className="quest-icon"><Rocket className="w-5 h-5" /></span><div><h2 className="text-xl font-bold text-white">Launch basics</h2><p className="text-sm text-slate-300">Choose your kind of campaign and your goal.</p></div></div>
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="space-y-2 min-w-0"><Label className="quest-label">What kind?</Label><Select value={form.category} onValueChange={(v) => set("category", v)}><SelectTrigger className="quest-input"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 min-w-0"><Label className="quest-label flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Goal</Label><Input className="quest-input" type="number" min="1" placeholder="$5,000" value={form.goal_amount} onChange={(e) => set("goal_amount", e.target.value)} /></div>
          </div>
          <label className="flex items-start gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-4 cursor-pointer"><input type="checkbox" checked={form.accept_crypto_donations} onChange={(e) => set("accept_crypto_donations", e.target.checked)} className="mt-1 accent-cyan-400" /><span className="text-sm text-slate-100"><span className="flex gap-2 items-center font-semibold"><Wallet className="w-4 h-4" /> Allow cryptocurrency donations</span><span className="block text-xs text-slate-300 mt-1">Optional. Wallet connection and receiving will appear when IFund completes secure crypto settlement setup. No coins are accepted before verification is ready.</span></span></label>
          <details className="rounded-2xl border border-violet-400/25 bg-violet-500/10 overflow-hidden group"><summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-sm font-semibold text-violet-100"><span className="flex items-center gap-2"><Wand2 className="w-4 h-4 text-cyan-300" /> Add extras <span className="font-normal text-slate-400">(optional)</span></span><span className="text-cyan-300 group-open:rotate-45 transition-transform">+</span></summary><div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/10"><div className="space-y-2"><Label className="quest-label">Deadline</Label><Input className="quest-input" type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></div><div className="space-y-2"><Label className="quest-label">Where is this happening?</Label><div className="flex gap-2 min-w-0"><Input className="quest-input flex-1 min-w-0" placeholder="City, state" value={form.location} onChange={(e) => set("location", e.target.value)} onBlur={locate} /><Button type="button" variant="outline" onClick={locate} disabled={locating || !form.location} className="quest-button shrink-0">{locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}<span className="hidden sm:inline ml-1">Find</span></Button></div></div></div></details>
        </div>)}

        {step === 2 && (<>
          <CampaignCopyChoices form={form} onChange={set} />
          <div className="rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 pt-4"><h3 className="text-lg font-bold text-white">3. Make your story</h3><p className="text-xs text-slate-300">Click to create or improve your story. Your final text stays editable below.</p></div>
          <AIStoryGenerator form={form} aiProfile={form.ai_profile} versions={form.story_versions} onApply={(text) => set("story", text)} onSaveVersion={(ver) => setForm((f) => ({ ...f, story_versions: [...(f.story_versions || []).filter((v) => v.text?.trim() !== ver.text?.trim()), ver].slice(-50) }))} onRestoreVersion={(ver) => set("story", ver.text)} />
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 p-4 sm:p-5 space-y-2"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Final transmission</p><Label className="quest-label text-base">Your campaign story</Label></div><Textarea rows={10} className="quest-input min-h-56 resize-y whitespace-pre-wrap break-words" placeholder="Write it yourself or forge a draft above, then remix it here." value={form.story} onChange={(e) => set("story", e.target.value)} /><p className="text-xs text-slate-400">This is the one story that goes live. Story Forge edits this same field and keeps earlier versions available to restore.</p></div>
          <div className="space-y-2">
            <Label className="quest-label">Campaign art</Label>
            <Image src={form.cover_image_url || FALLBACK_IMAGE} alt={form.cover_image_url ? "Campaign cover preview" : "Default campaign cover"} className="w-full max-h-[32rem] rounded-xl object-contain bg-slate-950" />
            {form.cover_image_is_ai && <p className="text-xs text-slate-300">AI-generated illustration · People shown may represent the campaign subjects.</p>}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0">
              <Button type="button" variant="outline" onClick={generateCover} disabled={generatingImage || !form.title} className="quest-button w-full sm:w-auto">{generatingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}Generate Image</Button>
              <div className="flex-1 min-w-0 sm:min-w-[12rem]"><MediaUpload value={form.cover_image_url} onChange={(url) => setForm((current) => ({ ...current, cover_image_url: url, cover_image_is_ai: false }))} label="Upload your own photo" previewClassName="hidden" /></div>
            </div>
            <p className="text-xs text-slate-400 break-words">Cover image is optional. Upload a photo, generate artwork, or launch with IFund's default cover.</p>
          </div>
        </>)}

        {step === 3 && <div className="space-y-4 min-w-0 text-slate-200">{form.cover_image_url && <Image src={form.cover_image_url} alt="Campaign cover" className="w-full max-h-[32rem] rounded-xl object-contain bg-slate-950" />}<div className="min-w-0"><p className="text-[11px] font-medium uppercase tracking-wider text-primary">{categoryLabels[form.category]}</p><h2 className="font-display text-2xl text-white break-words">{form.title}</h2>{form.summary && <p className="text-slate-300 mt-1 whitespace-pre-wrap break-words">{form.summary}</p>}</div><p className="text-sm text-slate-300 break-words">Goal: <span className="font-semibold text-cyan-200">${parseFloat(form.goal_amount || 0).toLocaleString()}</span>{form.end_date && ` · Ends ${form.end_date}`}</p>{form.story && <details className="rounded-2xl border border-white/10 bg-slate-950/35 p-4" open><summary className="cursor-pointer text-sm font-semibold text-cyan-200 mb-2">Campaign story</summary><p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{form.story}</p></details>}</div>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={saveDraft} disabled={saving} className="quest-button min-h-11">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save draft
        </Button>
        <span role="status" className="text-xs text-slate-300">{draftNotice || "Save at any step. Your draft stays private until you publish it."}</span>
      </div>
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 min-w-0">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="quest-button"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        {step < 3 ? <Button type="button" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={!canNext} className="rounded-2xl min-h-12 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-bold hover:opacity-90">Continue <ArrowRight className="w-4 h-4 ml-2" /></Button> : <div className="flex flex-col sm:flex-row gap-2 min-w-0"><Button type="button" onClick={() => launch("active")} disabled={saving} className="rounded-2xl min-h-12 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-bold hover:opacity-90">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Launch campaign"}</Button></div>}
      </div>
    </div>
  );
}