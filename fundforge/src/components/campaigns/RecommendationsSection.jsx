import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, X } from 'lucide-react';
import CampaignCard from '@/components/campaigns/CampaignCard';

export default function RecommendationsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kindred_dismissed_recs') || '[]'); } catch { return []; }
  });

  const load = async (d) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getRecommendations', { dismissed: d });
      setItems(res?.data?.recommendations || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(dismissed); }, []);

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('kindred_dismissed_recs', JSON.stringify(next));
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (!loading && items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold tracking-tight flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> Recommended for You</h2>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[1, 2, 3].map((i) => <div key={i} className="h-56 rounded-2xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((c) => (
            <div key={c.id} className="relative">
              <CampaignCard campaign={c} donorCount={c.donor_count || 0} />
              <div className="absolute top-2 left-2 z-10 max-w-[70%]">
                <span className="text-[9px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-400/90 text-[#0B0F0E] font-medium truncate block" title={`Why? ${c.reason}`}>{c.reason}</span>
              </div>
              <button onClick={() => dismiss(c.id)} className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-stone-300 hover:text-white" title="Not interested">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}