import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Trophy, Crown, Medal, Heart, Users } from 'lucide-react';
import { formatGlobal, convert } from '@/utils/currency';
import SEO from '@/components/seo/SEO';
import { cn } from '@/lib/utils';

const tabs = ['All Time', 'This Month', 'This Year'];

export default function Leaderboard() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All Time');

  useEffect(() => {
    base44.entities.Donation.list('-created_date', 500).then(setDonations).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return donations.filter((d) => {
      const dt = new Date(d.created_date);
      if (tab === 'This Month') return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
      if (tab === 'This Year') return dt.getFullYear() === now.getFullYear();
      return true;
    });
  }, [donations, tab]);

  const donors = useMemo(() => {
    const m = {};
    filtered.forEach((d) => {
      if (d.anonymous) return;
      const n = d.donor_name || 'Anonymous';
      if (!m[n]) m[n] = { name: n, total: 0, count: 0, campaigns: new Set() };
      m[n].total += convert(d.amount, d.currency);
      m[n].count += 1;
      m[n].campaigns.add(d.campaign_id);
    });
    return Object.values(m).map((d) => ({ ...d, campaigns: d.campaigns.size })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const top20 = donors.slice(0, 20);
  const podium = donors.slice(0, 3);

  const mostGenerous = useMemo(() => {
    const m = {};
    filtered.forEach((d) => { if (d.anonymous) return; const n = d.donor_name || 'Anonymous'; m[n] = Math.max(m[n] || 0, convert(d.amount, d.currency)); });
    return Object.entries(m).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [filtered]);

  const mostSupportive = useMemo(() => [...donors].sort((a, b) => b.campaigns - a.campaigns).slice(0, 5), [donors]);

  const rankStyle = (i) => i === 0 ? 'from-amber-300 to-yellow-500' : i === 1 ? 'from-slate-300 to-slate-400' : i === 2 ? 'from-orange-400 to-amber-600' : 'from-white/5 to-white/5';
  const rankIcon = (i) => i === 0 ? Crown : i === 1 ? Medal : i === 2 ? Medal : null;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto pb-20 md:pb-10">
      <SEO title="Donor Leaderboard · Kindred" description="Kindred's most generous supporters." />
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Community</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight flex items-center gap-2"><Trophy className="w-7 h-7 text-amber-400" /> Donor Leaderboard</h1>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-2 rounded-xl text-xs font-medium transition-colors', tab === t ? 'bg-emerald-400 text-[#0B0F0E]' : 'bg-white/[0.03] border border-white/10 text-stone-400 hover:text-stone-200')}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : top20.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
          <Trophy className="w-10 h-10 text-stone-700 mx-auto mb-3" />
          <p className="font-medium mb-1">No donors yet</p>
          <p className="text-sm text-stone-500 mb-5">Be the first to appear on the leaderboard.</p>
          <Link to="/discover" className="inline-block px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium text-sm">Browse Campaigns</Link>
        </div>
      ) : (
        <>
          {podium.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[1, 0, 2].map((idx) => {
                const d = podium[idx];
                if (!d) return <div key={idx} />;
                const Icon = rankIcon(idx);
                return (
                  <div key={idx} className={cn('rounded-2xl p-4 text-center border border-white/5 bg-gradient-to-b', rankStyle(idx), idx === 0 && 'pt-6 -mt-2')}>
                    {Icon && <Icon className={cn('w-5 h-5 mx-auto mb-2', idx === 0 ? 'text-[#0B0F0E]' : 'text-[#0B0F0E]')} />}
                    <div className={cn('w-12 h-12 mx-auto rounded-full flex items-center justify-center font-semibold text-lg mb-2', idx === 0 ? 'bg-[#0B0F0E]/20 text-[#0B0F0E]' : 'bg-[#0B0F0E]/20 text-[#0B0F0E]')}>{d.name[0]?.toUpperCase()}</div>
                    <p className="font-medium text-sm text-[#0B0F0E] truncate">{d.name}</p>
                    <p className="text-xs text-[#0B0F0E]/70 mt-0.5">{formatGlobal(d.total)}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden mb-8">
            {top20.map((d, i) => (
              <div key={d.name} className="flex items-center gap-4 p-4 border-b border-white/[0.03] last:border-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0 bg-gradient-to-br', rankStyle(i), i < 3 ? 'text-[#0B0F0E]' : 'text-stone-400 bg-white/[0.03]')}>{i + 1}</div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold shrink-0">{d.name[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-stone-500">{d.campaigns} {d.campaigns === 1 ? 'campaign' : 'campaigns'} · {d.count} {d.count === 1 ? 'donation' : 'donations'}</p>
                </div>
                <p className="font-semibold text-emerald-300">{formatGlobal(d.total)}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400" /> Most Generous</h2>
              <div className="space-y-3">
                {mostGenerous.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate"><span className="text-stone-600 w-4">{i + 1}</span> {d.name}</span>
                    <span className="text-emerald-300 font-medium shrink-0">{formatGlobal(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-sky-400" /> Most Supportive</h2>
              <div className="space-y-3">
                {mostSupportive.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate"><span className="text-stone-600 w-4">{i + 1}</span> {d.name}</span>
                    <span className="text-sky-300 font-medium shrink-0">{d.campaigns} {d.campaigns === 1 ? 'campaign' : 'campaigns'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}