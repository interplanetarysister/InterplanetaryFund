import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, ArrowRight, ArrowLeft, Loader2, Wand2, Check, Share2, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import CampaignForm from '@/components/campaigns/CampaignForm';
import ShareModal from '@/components/campaigns/ShareModal';
import SEO from '@/components/seo/SEO';

const steps = [
  { key: 'what', label: 'What happened?', placeholder: 'Describe the situation that led to this fundraiser…', type: 'textarea' },
  { key: 'why', label: 'Why do you need funds?', placeholder: 'Explain how the funds will be used…', type: 'textarea' },
  { key: 'beneficiary', label: 'Who benefits?', placeholder: 'Who will receive the support?', type: 'text' },
  { key: 'goal', label: 'Funding goal ($)', placeholder: 'e.g. 5000', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] },
  { key: 'timeline', label: 'Timeline', placeholder: 'e.g. 30 days, or by end of August', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: ['medical', 'education', 'disaster-relief', 'animals', 'community', 'memorial', 'business', 'creative', 'charity', 'other'] },
];

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [published, setPublished] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  const current = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;
  const canProceed = answers[current.key] !== undefined && answers[current.key] !== '';

  const generate = async () => {
    setGenerating(true);
    try {
      const prompt = `You are an expert fundraising copywriter. Create a compelling, ethical fundraiser campaign based on these details:
- What happened: ${answers.what}
- Why funds needed: ${answers.why}
- Beneficiary: ${answers.beneficiary}
- Goal: $${answers.goal}
- Timeline: ${answers.timeline}
- Category: ${answers.category}

Generate emotional, trustworthy, well-structured content. Be specific and human. Format the FAQ as Q: ... / A: ... pairs.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            short_description: { type: 'string' },
            description: { type: 'string' },
            story: { type: 'string' },
            faq: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            seo_content: { type: 'string' },
            social_captions: { type: 'string' },
            press_release: { type: 'string' },
            donor_thank_you: { type: 'string' },
            image_prompt: { type: 'string' }
          }
        }
      });

      let organizer = '';
      try { const u = await base44.auth.me(); organizer = u.full_name || u.email; } catch {}
      setEditing({ ...res, organizer_name: organizer, raised: 0, status: 'active', currency: answers.currency || 'USD' });
    } catch (e) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const generateImage = async () => {
    if (!editing?.image_prompt) return;
    setGeneratingImage(true);
    try {
      const res = await base44.integrations.Core.GenerateImage({ prompt: editing.image_prompt });
      setEditing({ ...editing, image_url: res.url });
    } catch (e) {
      toast({ title: 'Image generation failed', variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const c = await base44.entities.Campaign.create({
        organizer_name: editing.organizer_name,
        title: editing.title,
        short_description: editing.short_description,
        description: editing.description,
        story: editing.story,
        faq: editing.faq,
        tags: editing.tags,
        seo_content: editing.seo_content,
        social_captions: editing.social_captions,
        press_release: editing.press_release,
        donor_thank_you: editing.donor_thank_you,
        image_url: editing.image_url,
        goal: Number(editing.goal),
        raised: Number(editing.raised) || 0,
        category: editing.category,
        beneficiary: editing.beneficiary,
        timeline: editing.timeline,
        location: editing.location,
        is_featured: !!editing.is_featured,
        status: editing.status || 'active',
        currency: editing.currency || 'USD',
      });
      toast({ title: 'Campaign published!', description: 'Your fundraiser is now live.', variant: 'success' });
      setPublished(c);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/campaign/${published.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: published.title, text: published.short_description || published.title, url: shareUrl }); return; } catch {}
    }
    setShareOpen(true);
  };

  if (published) {
    const shareUrl = `${window.location.origin}/campaign/${published.id}`;
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto pb-20 md:pb-10 text-center">
        <SEO title="Campaign Published · Kindred" description="Your Kindred campaign is live." />
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5"><PartyPopper className="w-8 h-8 text-emerald-400" /></div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Your campaign is live! 🎉</h1>
        <p className="text-sm text-stone-500 mb-8 max-w-md mx-auto">Share it now to start raising funds. One tap shares to all your networks.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <Button onClick={handleShare} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 rounded-xl px-6"><Share2 className="w-4 h-4" /> Share Campaign</Button>
          <Button variant="outline" onClick={() => navigate(`/campaign/${published.id}`)} className="border-white/10 bg-white/[0.03] gap-2 rounded-xl">View Campaign</Button>
        </div>
        <p className="text-xs text-stone-600">Campaign link: <span className="text-stone-400">{shareUrl}</span></p>
        <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} campaign={published} shareUrl={shareUrl} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto pb-20 md:pb-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> AI-Generated Campaign</p>
            <h1 className="text-3xl font-semibold tracking-tight">Review & Edit</h1>
          </div>
          <Button variant="outline" onClick={() => setEditing(null)} className="border-white/10 bg-white/[0.03]">Regenerate</Button>
        </div>
        <div className={cn('rounded-2xl border p-4 mb-6 flex items-start gap-3 transition-colors', accepted ? 'border-emerald-400/30 bg-emerald-400/[0.03]' : 'border-amber-400/30 bg-amber-400/[0.03]')}>
          <button type="button" onClick={() => setAccepted(!accepted)} className={cn('mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors', accepted ? 'bg-emerald-400 border-emerald-400 text-[#0B0F0E]' : 'border-amber-400/50 bg-transparent')} aria-label="Accept responsibility">
            {accepted && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          </button>
          <div>
            <p className="text-sm font-medium">I accept responsibility for this campaign</p>
            <p className="text-xs text-stone-500 mt-0.5">I confirm the information is accurate, I'm authorized to raise funds for the beneficiary, and my account is accountable for this campaign.</p>
          </div>
        </div>
        <CampaignForm value={editing} onChange={setEditing} onSave={save} saving={saving} onGenerateImage={generateImage} generatingImage={generatingImage} canSave={accepted} />
        {!accepted && <p className="text-xs text-amber-400/70 mt-3 text-center">Accept responsibility above to enable publishing.</p>}
      </div>
    );
  }

  if (generating) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Wand2 className="w-8 h-8 text-emerald-300" />
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-2">Crafting your campaign…</h2>
        <p className="text-sm text-stone-500 max-w-sm">The AI is writing your story, FAQ, SEO content, social captions, press release, and donor thank-you messages.</p>
        <div className="mt-8 space-y-2 text-left w-full max-w-sm">
          {['Title & description', 'Emotional storytelling', 'FAQ & updates', 'SEO & social captions', 'Press release', 'Donor thank-you messages'].map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-stone-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" /> {t}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto pb-20 md:pb-10">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> AI Campaign Agent
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Let's create your fundraiser</h1>
        <p className="text-sm text-stone-500 mt-2">Answer a few questions. The AI will craft a complete, compelling campaign you can edit and publish.</p>
      </div>

      <div className="flex items-center gap-1.5 mb-8">
        {steps.map((_, i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-all', i <= stepIdx ? 'bg-emerald-400' : 'bg-white/10')} />
        ))}
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-7">
        <label className="block text-lg font-medium mb-4">{current.label}</label>
        {current.type === 'textarea' ? (
          <Textarea
            value={answers[current.key] || ''}
            onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
            placeholder={current.placeholder}
            rows={5}
            autoFocus
            className="bg-white/[0.03] border-white/10 rounded-xl resize-none"
          />
        ) : current.type === 'select' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {current.options.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswers({ ...answers, [current.key]: opt })}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-sm capitalize transition-all border',
                  answers[current.key] === opt ? 'bg-emerald-400 text-[#0B0F0E] border-emerald-400' : 'bg-white/[0.03] border-white/10 text-stone-300 hover:bg-white/[0.06]'
                )}
              >
                {opt.replace('-', ' ')}
              </button>
            ))}
          </div>
        ) : (
          <Input
            value={answers[current.key] || ''}
            onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
            placeholder={current.placeholder}
            type={current.type}
            autoFocus
            className="bg-white/[0.03] border-white/10 rounded-xl"
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={() => setStepIdx(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0} className="text-stone-400 gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        {isLast ? (
          <Button onClick={generate} disabled={!canProceed} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 rounded-xl px-6">
            <Wand2 className="w-4 h-4" /> Generate Campaign
          </Button>
        ) : (
          <Button onClick={() => setStepIdx(stepIdx + 1)} disabled={!canProceed} className="bg-white/[0.06] hover:bg-white/[0.1] text-stone-100 font-medium gap-2 rounded-xl">
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}