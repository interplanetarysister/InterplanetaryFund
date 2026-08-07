import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Heart, Loader2, X, Users, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/campaigns/EmptyState';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCsv } from '@/utils/exportCsv';
import { formatMoney, convert, formatGlobal } from '@/utils/currency';
import SEO from '@/components/seo/SEO';

const tierFor = (total) => (total >= 1000 ? 'Platinum' : total >= 500 ? 'Gold' : total >= 100 ? 'Silver' : 'Bronze');
const tierStyle = {
  Platinum: 'bg-violet-400/15 text-violet-300',
  Gold: 'bg-amber-400/15 text-amber-300',
  Silver: 'bg-slate-300/15 text-slate-300',
  Bronze: 'bg-orange-400/15 text-orange-300',
};

export default function Donors() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(null);
  const { toast } = useToast();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    (async () => {
      try {
        const d = await base44.entities.Donation.list('-created_date', 500);
        setDonations(d);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const donors = useMemo(() => {
    const m = {};
    donations.forEach((d) => {
      if (!d.donor_name) return;
      if (!m[d.donor_name]) m[d.donor_name] = { name: d.donor_name, total: 0, campaigns: new Set(), last: 0, history: [] };
      m[d.donor_name].total += convert(d.amount, d.currency);
      m[d.donor_name].campaigns.add(d.campaign_id);
      const ts = new Date(d.created_date).getTime();
      if (ts > m[d.donor_name].last) m[d.donor_name].last = ts;
      m[d.donor_name].history.push(d);
    });
    return Object.values(m)
      .map((d) => ({ ...d, campaignCount: d.campaigns.size }))
      .filter((d) => !debouncedQuery || d.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
      .sort((a, b) => (sortDir === 'desc' ? b.total - a.total : a.total - b.total));
  }, [donations, debouncedQuery, sortDir]);

  const exportDonors = () => {
    exportToCsv('kindred-donors.csv', donors.map((d) => ({ name: d.name, email: '', amount: d.total, date: new Date(d.last).toLocaleDateString(), campaign: '' })));
    toast({ title: 'Donors exported', variant: 'success' });
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <SEO title="Donors · Kindred" description="Your donor community on Kindred." />
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Supporters</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Donors</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search donors…" className="pl-10 bg-white/[0.03] border-white/10 rounded-xl" />
        </div>
        <button onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')} className="px-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-stone-300 hover:bg-white/[0.06]">
          Total {sortDir === 'desc' ? '↓' : '↑'}
        </button>
        <Button onClick={exportDonors} variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl"><Download className="w-4 h-4" /> Export CSV</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : donors.length === 0 ? (
        <EmptyState icon={Users} title="No donors yet" subtitle="Donors will appear here once people start contributing to your campaigns." action={<Link to="/discover"><Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] gap-2 rounded-xl">Browse Campaigns</Button></Link>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {donors.map((d) => (
            <button key={d.name} onClick={() => setSelected(d)} className="text-left rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold">{d.name[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.name}</p>
                  <p className="text-xs text-stone-500">{d.campaignCount} campaign{d.campaignCount !== 1 ? 's' : ''} · {d.history.length} donations</p>
                </div>
                <span className={cn('text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-semibold', tierStyle[tierFor(d.total)])}>{tierFor(d.total)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-semibold text-emerald-300">{formatGlobal(d.total)}</span>
                <span className="text-[11px] text-stone-500">Last: {new Date(d.last).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full sm:max-w-lg bg-[#0E1311] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold">{selected.name[0]?.toUpperCase()}</div>
                <div>
                  <h3 className="font-semibold">{selected.name}</h3>
                  <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold inline-block', tierStyle[tierFor(selected.total)])}>{tierFor(selected.total)} tier</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-stone-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                  <p className="text-lg font-semibold text-emerald-300">{formatGlobal(selected.total)}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">Total</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                  <p className="text-lg font-semibold">{selected.campaignCount}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">Campaigns</p>
                </div>
                <div className="rounded-xl bg-white/[0.03] p-3 text-center">
                  <p className="text-lg font-semibold">{selected.history.length}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider">Donations</p>
                </div>
              </div>
              <p className="text-xs uppercase tracking-wider text-stone-500 mb-3">Donation History</p>
              <div className="space-y-2">
                {[...selected.history].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map((d, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-3 border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0"><Heart className="w-3.5 h-3.5 text-emerald-400" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-medium truncate">{d.campaign_title || 'Campaign'}</p>
                        <span className="text-sm font-semibold text-emerald-300 shrink-0">{formatMoney(d.amount, d.currency)}</span>
                      </div>
                      {d.message && <p className="text-xs text-stone-400 mt-0.5">"{d.message}"</p>}
                      <p className="text-[10px] text-stone-500 mt-1 capitalize">{d.platform || 'direct'} · {new Date(d.created_date).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-stone-600">Kindred — AI-Powered Fundraising OS · © 2026</p>
      </footer>
    </div>
  );
}