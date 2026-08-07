import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart } from 'lucide-react';
import { formatMoney } from '@/utils/currency';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function RecentActivity() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const d = await base44.entities.Donation.list('-created_date', 8);
        setItems(d);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h2 className="font-semibold mb-1 flex items-center gap-2"><Heart className="w-4 h-4 text-emerald-400" /> Recent Activity</h2>
      <p className="text-xs text-stone-500 mb-4 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live donations across Kindred</p>
      <div className="space-y-2.5">
        {items.map((d) => (
          <div key={d.id} className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold text-xs shrink-0">{d.anonymous ? '?' : (d.donor_name?.[0]?.toUpperCase() || '?')}</div>
            <p className="flex-1 min-w-0 truncate">
              <span className="font-medium">{d.anonymous ? 'Anonymous' : d.donor_name || 'Someone'}</span>{' '}
              <span className="text-stone-500">donated to</span>{' '}
              <span className="text-emerald-300 truncate">{d.campaign_title || 'a campaign'}</span>
            </p>
            <span className="text-emerald-300 font-semibold text-xs shrink-0">{formatMoney(d.amount, d.currency)}</span>
            <span className="text-[10px] text-stone-600 shrink-0 w-14 text-right">{timeAgo(new Date(d.created_date).getTime())}</span>
          </div>
        ))}
      </div>
    </div>
  );
}