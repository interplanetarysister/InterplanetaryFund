import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import CampaignCard from '@/components/campaigns/CampaignCard';
import CampaignCardSkeleton from '@/components/campaigns/CampaignCardSkeleton';

export default function FeaturedCarousel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const scroller = useRef();

  useEffect(() => {
    base44.entities.Campaign.filter({ is_featured: true }, '-raised', 6)
      .then((c) => setItems(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && items.length === 0) return null;

  const scroll = (dir) => {
    if (scroller.current) scroller.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold tracking-tight flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> Featured Campaigns</h2>
        {items.length > 2 && (
          <div className="flex gap-1">
            <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center" aria-label="Scroll left"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => scroll(1)} className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center" aria-label="Scroll right"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="flex gap-5 overflow-hidden">{[1, 2, 3].map((i) => <div key={i} className="w-72 shrink-0"><CampaignCardSkeleton /></div>)}</div>
      ) : (
        <div ref={scroller} className="flex gap-5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
          {items.map((c) => (
            <div key={c.id} className="w-72 shrink-0">{<CampaignCard campaign={c} />}</div>
          ))}
        </div>
      )}
    </div>
  );
}