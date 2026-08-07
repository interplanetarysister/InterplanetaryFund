import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Trophy, Quote } from 'lucide-react';
import { formatMoney } from '@/utils/currency';

export default function SuccessStories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.Campaign.list('-raised', 200);
        const stories = all.filter((c) => c.goal && (c.raised || 0) >= c.goal).slice(0, 3);
        setItems(stories);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h2 className="font-semibold tracking-tight">Success Stories</h2>
      </div>
      {loading ? (
        <div className="grid md:grid-cols-3 gap-5">{[1, 2, 3].map((i) => <div key={i} className="h-44 rounded-2xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((c) => (
            <Link key={c.id} to={`/campaign/${c.id}`} className="group rounded-2xl border border-white/5 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-5 hover:border-emerald-400/20 transition-all flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1"><Trophy className="w-3 h-3" /> Goal Reached</span>
              <h3 className="font-medium mb-2 line-clamp-2">{c.title}</h3>
              <p className="text-2xl font-semibold text-emerald-300 mb-1">{formatMoney(c.raised, c.currency)}</p>
              <p className="text-xs text-stone-500 mb-3">raised of {formatMoney(c.goal, c.currency)} goal</p>
              {c.organizer_name && (
                <div className="mt-auto pt-3 border-t border-white/5">
                  <Quote className="w-3 h-3 text-emerald-400/60 mb-1" />
                  <p className="text-xs text-stone-400 italic line-clamp-2">"{c.donor_thank_you || 'Thanks to our amazing community, we hit our goal. Every contribution changed lives.'}"</p>
                  <p className="text-[11px] text-emerald-400/70 mt-1">— {c.organizer_name}</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}