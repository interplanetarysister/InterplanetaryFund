import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
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
import MediaUpload from "@/components/media/MediaUpload";
import { buildCoverPrompt } from "@/lib/coverPrompt";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, MapPin } from "lucide-react";

const steps = ["AI Setup", "Basics", "Story", "Launch"];
const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [regenCount, setRegenCount] = useState(0);
  const [form, setForm] = useState({
    title: "", category: "other", goal_amount: "", end_date: "",
    summary: "", story: "", cover_image_url: "",
    location: "", location_lat: null, location_lng: null,
    ai_profile: emptyAiProfile, story_versions: [],
  });
  const [locating, setLocating] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const locate = async () => {
    if (!form.location) return;
    setLocating(true);
    try {
      const res = await base44.functions.invoke("geocodeCity", { city: form.location });
      const err = res.error || res.data?.error;
      if (err) throw new Error(err);
      setForm((f) => ({ ...f, location_lat: res.data.lat, location_lng: res.data.lng }));
      toast({ title: "Location found", description: (res.data.display || form.location).split(",")[0] });
    } catch (e) {
      setForm((f) => ({ ...f, location_lat: null, location_lng: null }));
      toast({ title: "Couldn't find that city", description: e.message, variant: "destructive" });
    }
    setLocating(false);
  };

  const generateCover = async () => {
    setGeneratingImage(true);
    try {
      const { url } = await base44.integrations.Core.GenerateImage({
        prompt: buildCoverPrompt({ title: form.title, category: form.category, regenCount }),
      });
      set("cover_image_url", url);
      setRegenCount((c) => c + 1);
    } catch (e) {
      toast({ title: "Couldn't generate cover", description: "Please try again or upload your own image.", variant: "destructive" });
    }
    setGeneratingImage(false);
  };

  const launch = async (status) => {
    if (status === "active") {
      const missing = [];
      if (!form.title?.trim()) missing.push("title");
      if (!form.summary?.trim()) missing.push("summary");
      if (!form.story?.trim()) missing.push("story");
      if (!form.cover_image_url) missing.push("cover image");
      if (!form.end_date) missing.push("end date");
      if (!(parseFloat(form.goal_amount) > 0)) missing.push("goal amount");
      if (missing.length) {
        toast({ title: "Campaign isn't ready to launch", description: `Please add: ${missing.join(", ")}.`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const campaign = await base44.entities.Campaign.create({
        ...form,
        goal_amount: parseFloat(form.goal_amount),
        end_date: form.end_date || undefined,
        location: form.location || undefined,
        location_lat: form.location_lat || undefined,
        location_lng: form.location_lng || undefined,
        status,
      });
      navigate(`/campaign/${campaign.id}`);
    } catch (e) {
      toast({ title: "Couldn't launch campaign", description: e.message, variant: "destructive" });
      setSaving(false);
    }
  };

  const canNext = step === 0 ? true : step === 1 ? form.title && parseFloat(form.goal_amount) > 0 : true;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${i <= step ? "text-stone-900" : "text-stone-300"}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-slate-900 text-white" : "bg-slate-100"
              }`}>{i + 1}</span>
              <span className="text-sm font-medium hidden sm:block">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-stone-200" />}
          </React.Fragment>
        ))}
      </div>

      <h1 className="font-display text-3xl text-stone-900 mb-6">
        {step === 0 && "Set up your AI"}
        {step === 1 && "Let's set the basics"}
        {step === 2 && "Tell your story"}
        {step === 3 && "Review & launch"}
      </h1>

      <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm space-y-5">
        {step === 0 && (
          <AIInstructionsStep value={form.ai_profile} onChange={(p) => set("ai_profile", p)} />
        )}

        {step === 1 && (<>
          <div className="space-y-1.5">
            <Label>Campaign title</Label>
            <Input placeholder="e.g. Help Maria's Recovery Journey" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Goal amount ($)</Label>
              <Input type="number" min="1" placeholder="5000" value={form.goal_amount} onChange={(e) => set("goal_amount", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>End date (optional)</Label>
            <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location (city)</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g. Portland, OR" value={form.location} onChange={(e) => set("location", e.target.value)} onBlur={locate} className="flex-1" />
              <Button type="button" variant="outline" onClick={locate} disabled={locating || !form.location} className="rounded-xl shrink-0">
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                Locate
              </Button>
            </div>
            <p className="text-xs text-stone-400">So supporters can find your campaign on the global globe.</p>
          </div>
        </>)}

        {step === 2 && (<>
          <div className="space-y-1.5">
            <Label>Short summary</Label>
            <Input placeholder="One sentence that captures your cause" value={form.summary} onChange={(e) => set("summary", e.target.value)} />
          </div>
          <AIStoryGenerator
            form={form}
            aiProfile={form.ai_profile}
            versions={form.story_versions}
            onApply={(text) => set("story", text)}
            onSaveVersion={(ver) => setForm((f) => ({ ...f, story_versions: [...(f.story_versions || []), ver] }))}
            onRestoreVersion={(ver) => set("story", ver.text)}
          />
          <div className="space-y-1.5">
            <Label>Your story</Label>
            <Textarea rows={8} placeholder="Share the background, why help is needed, and how funds will be used…" value={form.story} onChange={(e) => set("story", e.target.value)} />
            <p className="text-xs text-stone-400">Detailed, authentic stories build donor trust.</p>
          </div>
          <div className="space-y-2">
            <Label>Cover image</Label>
            {form.cover_image_url ? (
              isVideo(form.cover_image_url) ? (
                <video src={form.cover_image_url} controls className="w-full h-44 rounded-xl object-cover" />
              ) : (
                <Image src={form.cover_image_url} alt="Cover preview" className="w-full h-44 rounded-xl object-cover" />
              )
            ) : (
              <Image src={FALLBACK_IMAGE} alt="Default cover" className="w-full h-44 rounded-xl object-cover" />
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={generateCover} disabled={generatingImage || !form.title} className="rounded-xl">
                {generatingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-primary" />}
                {form.cover_image_url ? "Regenerate with AI" : "Generate with AI"}
              </Button>
              <div className="flex-1 min-w-[12rem]">
                <MediaUpload
                  value={form.cover_image_url}
                  onChange={(url) => set("cover_image_url", url)}
                  label="Upload your own"
                  previewClassName="hidden"
                />
              </div>
            </div>
            <p className="text-xs text-stone-400">Upload your own photo or video, or generate a cover with AI. Each regeneration gives you a fresh style.</p>
          </div>
        </>)}

        {step === 3 && (
          <div className="space-y-4">
            {form.cover_image_url && (isVideo(form.cover_image_url) ? (
              <video src={form.cover_image_url} controls className="w-full h-44 rounded-xl object-cover" />
            ) : (
              <Image src={form.cover_image_url} alt="Cover" className="w-full h-44 rounded-xl object-cover" />
            ))}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary">{categoryLabels[form.category]}</p>
              <h2 className="font-display text-2xl text-stone-900">{form.title}</h2>
              {form.summary && <p className="text-stone-600 mt-1">{form.summary}</p>}
            </div>
            <p className="text-sm text-stone-500">Goal: <span className="font-semibold text-stone-900">${parseFloat(form.goal_amount || 0).toLocaleString()}</span>{form.end_date && ` · Ends ${form.end_date}`}</p>
            {form.story && <p className="text-sm text-stone-600 line-clamp-4 whitespace-pre-wrap">{form.story}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl">
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => launch("draft")} disabled={saving} className="rounded-xl">Save draft</Button>
            <Button onClick={() => launch("active")} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Launch campaign"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}