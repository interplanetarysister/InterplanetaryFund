import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ImagePlus, Loader2, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = ['medical', 'education', 'disaster-relief', 'animals', 'community', 'memorial', 'business', 'creative', 'charity', 'other'];
const statuses = ['draft', 'active', 'funded', 'closed'];
const inputCls = 'bg-white/[0.03] border-white/10 rounded-xl';
const selectCls = 'w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 capitalize';

function Section({ title, desc, children }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold mb-0.5">{title}</h3>
      {desc && <p className="text-xs text-stone-500 mb-4">{desc}</p>}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-400 mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-stone-600 mt-1">{hint}</p>}
    </div>
  );
}

export default function CampaignForm({ value, onChange, onSave, saving, onGenerateImage, generatingImage, canSave = true }) {
  const v = value || {};
  const set = (k, val) => onChange({ ...v, [k]: val });
  const pct = v.goal ? Math.min(100, ((v.raised || 0) / v.goal) * 100) : 0;
  const removeTag = (i) => set('tags', (v.tags || []).filter((_, idx) => idx !== i));

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-5">
        <Section title="Basics" desc="The core identity of your campaign.">
          <Field label="Campaign Title" hint="A clear, emotionally resonant title.">
            <Input value={v.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Help Maya Walk Again" className={inputCls} />
          </Field>
          <Field label="Short Description" hint="One sentence shown on cards and previews.">
            <Input value={v.short_description || ''} onChange={(e) => set('short_description', e.target.value)} placeholder="A brief summary of your cause" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={v.category || ''} onChange={(e) => set('category', e.target.value)} className={selectCls}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={v.status || 'draft'} onChange={(e) => set('status', e.target.value)} className={selectCls}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Funding" desc="Financial goals and who benefits.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Goal ($)" hint="Target amount to raise.">
              <Input type="number" value={v.goal ?? ''} onChange={(e) => set('goal', e.target.value ? Number(e.target.value) : '')} placeholder="5000" className={inputCls} />
            </Field>
            <Field label="Raised ($)" hint="Amount already raised, if any.">
              <Input type="number" value={v.raised ?? 0} onChange={(e) => set('raised', e.target.value ? Number(e.target.value) : 0)} placeholder="0" className={inputCls} />
            </Field>
          </div>
          <Field label="Beneficiary" hint="Who receives the support.">
            <Input value={v.beneficiary || ''} onChange={(e) => set('beneficiary', e.target.value)} placeholder="e.g. Maya's family" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Organizer" hint="Person running this campaign.">
              <Input value={v.organizer_name || ''} onChange={(e) => set('organizer_name', e.target.value)} placeholder="Your name" className={inputCls} />
            </Field>
            <Field label="Location" hint="Where the cause is based.">
              <Input value={v.location || ''} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Austin, TX" className={inputCls} />
            </Field>
          </div>
        </Section>

        <Section title="Story" desc="The narrative that moves people to give.">
          <Field label="Full Description" hint="A factual overview of the campaign.">
            <Textarea value={v.description || ''} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Describe the situation in detail" className={cn(inputCls, 'resize-none')} />
          </Field>
          <Field label="Emotional Story" hint="The personal, heartfelt narrative.">
            <Textarea value={v.story || ''} onChange={(e) => set('story', e.target.value)} rows={5} placeholder="Tell the human story behind this fundraiser" className={cn(inputCls, 'resize-none')} />
          </Field>
          <Field label="FAQ" hint="One per line — Q: … then A: …">
            <Textarea value={v.faq || ''} onChange={(e) => set('faq', e.target.value)} rows={4} placeholder={'Q: How will funds be used?\nA: ...'} className={cn(inputCls, 'resize-none')} />
          </Field>
        </Section>

        <Section title="Marketing & SEO" desc="AI-generated outreach assets you can edit.">
          <Field label="Tags">
            <div className="flex flex-wrap gap-2">
              {(v.tags || []).map((t, i) => (
                <button key={i} onClick={() => removeTag(i)} className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-rose-500/15 hover:text-rose-300 transition-colors">{t} ×</button>
              ))}
              {(v.tags || []).length === 0 && <span className="text-xs text-stone-600">No tags</span>}
            </div>
          </Field>
          <Field label="SEO Content" hint="Meta description for search engines.">
            <Textarea value={v.seo_content || ''} onChange={(e) => set('seo_content', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
          </Field>
          <Field label="Social Media Captions" hint="Ready-to-post captions with hashtags.">
            <Textarea value={v.social_captions || ''} onChange={(e) => set('social_captions', e.target.value)} rows={3} className={cn(inputCls, 'resize-none')} />
          </Field>
          <Field label="Press Release" hint="Formal announcement for media outreach.">
            <Textarea value={v.press_release || ''} onChange={(e) => set('press_release', e.target.value)} rows={3} className={cn(inputCls, 'resize-none')} />
          </Field>
          <Field label="Donor Thank-You Message" hint="Shown to donors after they contribute.">
            <Textarea value={v.donor_thank_you || ''} onChange={(e) => set('donor_thank_you', e.target.value)} rows={2} className={cn(inputCls, 'resize-none')} />
          </Field>
        </Section>

        <Section title="Display" desc="How your campaign looks across the app.">
          <Field label="Campaign Image" hint="Generate with AI or paste a URL.">
            <div className="flex gap-2">
              <Input value={v.image_url || ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" className={inputCls} />
              <Button type="button" variant="outline" onClick={onGenerateImage} disabled={generatingImage} className="border-white/10 bg-white/[0.03] gap-2 shrink-0">
                {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Generate
              </Button>
            </div>
          </Field>
          <button type="button" onClick={() => set('is_featured', !v.is_featured)} className="w-full flex items-center justify-between py-1">
            <div className="text-left">
              <p className="text-sm font-medium">Featured Campaign</p>
              <p className="text-[11px] text-stone-600">Highlight this on Discover.</p>
            </div>
            <span className={cn('w-9 h-5 rounded-full transition-colors relative', v.is_featured ? 'bg-emerald-400' : 'bg-white/10')}>
              <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', v.is_featured ? 'translate-x-4' : 'translate-x-0.5')} />
            </span>
          </button>
          <Field label="Timeline" hint="e.g. 30 days, or by end of August.">
            <Input value={v.timeline || ''} onChange={(e) => set('timeline', e.target.value)} placeholder="30 days" className={inputCls} />
          </Field>
        </Section>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving || !canSave} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 rounded-xl px-6">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Publishing…' : 'Publish Campaign'}
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:col-span-1">
        <div className="sticky top-6">
          <p className="text-xs uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Live Preview</p>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="h-32 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden relative">
              {v.image_url ? <img src={v.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-700 text-xs">No image</div>}
              {v.is_featured && <span className="absolute top-2 left-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-400 text-[#0B0F0E] font-semibold">Featured</span>}
              <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/15 text-stone-200 capitalize">{v.status || 'draft'}</span>
            </div>
            <div className="p-4">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 capitalize">{(v.category || 'category').replace('-', ' ')}</span>
              <h4 className="font-medium mt-1 line-clamp-1">{v.title || 'Untitled campaign'}</h4>
              {v.organizer_name && <p className="text-[11px] text-emerald-400/70">by {v.organizer_name}</p>}
              <p className="text-xs text-stone-500 line-clamp-2 mt-1.5">{v.short_description || 'Your short description appears here.'}</p>
              <div className="mt-3">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold">${(v.raised || 0).toLocaleString()}</span>
                  <span className="text-stone-500">of ${(v.goal || 0).toLocaleString()}</span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}