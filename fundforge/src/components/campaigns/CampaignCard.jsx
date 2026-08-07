import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Heart, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import LazyImage from '@/components/campaigns/LazyImage';
import VerifiedBadge from '@/components/campaigns/VerifiedBadge';
import { formatMoney } from '@/utils/currency';
import SaveButton from '@/components/campaigns/SaveButton';
import CompareButton from '@/components/campaigns/CompareButton';
import TrustBadge from '@/components/campaigns/TrustBadge';

const statusStyles = {
  active: 'bg-emerald-400 text-[#0B0F0E]',
  funded: 'bg-sky-400 text-[#0B0F0E]',
  closed: 'bg-stone-600 text-stone-200',
  draft: 'bg-white/10 text-stone-300',
};

export default function CampaignCard({ campaign: c, donorCount }) {
  const pct = c.goal ? Math.min(100, ((c.raised || 0) / c.goal) * 100) : 0;
  return (
    <Link
      to={`/campaign/${c.id}`}
      className="group rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 transition-all overflow-hidden flex flex-col"
    >
      <div className="h-40 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden relative">
        {c.image_url ? (
          <LazyImage src={c.image_url} alt={c.title} className="w-full h-full" imgClassName="group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-stone-700" />
          </div>
        )}
        {c.is_featured && (
          <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-400 text-[#0B0F0E] font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Featured
          </span>
        )}
        <span className={cn('absolute top-3 right-3 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-semibold capitalize', statusStyles[c.status] || statusStyles.draft)}>
          {c.status}
        </span>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1.5 capitalize">{(c.category || '').replace('-', ' ')}</span>
        <h3 className="font-medium mb-1 line-clamp-1 flex items-center gap-1">{c.title} {c.verified && <VerifiedBadge />}</h3>
        {c.organizer_name && <p className="text-[11px] text-emerald-400/70 mb-1.5">by {c.organizer_name}</p>}
        <p className="text-sm text-stone-500 line-clamp-2 mb-4 flex-1">{c.short_description}</p>
        <div className="space-y-1.5 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-stone-200 font-semibold">{formatMoney(c.raised, c.currency)}</span>
            <span className="text-stone-500">of {formatMoney(c.goal, c.currency)}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <span className="text-xs text-stone-500 flex items-center gap-1.5"><Heart className="w-3 h-3" /> {donorCount != null ? donorCount : '—'} {donorCount === 1 ? 'donor' : 'donors'} <TrustBadge donorCount={donorCount} /></span>
          <div className="flex items-center gap-2">
            <CompareButton campaign={c} className="w-7 h-7 rounded-lg hover:bg-white/5" />
            <SaveButton campaign={c} className="w-7 h-7 -mr-1 rounded-lg hover:bg-white/5" />
            <span className="text-xs font-medium text-emerald-300 group-hover:text-emerald-200">View →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}