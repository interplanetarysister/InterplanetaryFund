import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Heart, ArrowUpDown, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/campaigns/EmptyState';
import { useToast } from '@/components/ui/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCsv } from '@/utils/exportCsv';
import { formatMoney, convert, formatGlobal } from '@/utils/currency';
import SEO from '@/components/seo/SEO';

const platforms = ['direct', 'gofundme', 'kickstarter', 'indiegogo', 'givesendgo', 'fundly', 'mightycause'];
const statuses = ['pending', 'paid'];

export default function Donations() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const { toast } = useToast();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    (async () => {
      try {
        const d = await base44.entities.Donation.list('-created_date', 200);
        setDonations(d);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = donations;
    if (platform !== 'all') list = list.filter((d) => d.platform === platform);
    if (status !== 'all') list = list.filter((d) => d.status === status);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter((d) => (d.donor_name || '').toLowerCase().includes(q) || (d.campaign_title || '').toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const cmp = sortKey === 'amount' ? (a.amount || 0) - (b.amount || 0) : new Date(a.created_date) - new Date(b.created_date);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [donations, debouncedQuery, platform, status, sortKey, sortDir]);

  const total = filtered.reduce((s, d) => s + convert(d.amount, d.currency), 0);

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const exportDonations = () => {
    exportToCsv('kindred-donations.csv', filtered.map((d) => ({ name: d.donor_name, email: '', amount: d.amount, date: new Date(d.created_date).toLocaleDateString(), campaign: d.campaign_title })));
    toast({ title: 'Donations exported', variant: 'success' });
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <SEO title="Donations · Kindred" description="View all donations across your Kindred campaigns." />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Contributions</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Donations</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3">
            <p className="text-[10px] uppercase tracking-wider text-stone-500">Filtered Total</p>
            <p className="text-xl font-semibold text-emerald-300">{formatGlobal(total)}</p>
          </div>
          <Button onClick={exportDonations} variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl"><Download className="w-4 h-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search donor or campaign…" className="pl-10 bg-white/[0.03] border-white/10 rounded-xl" />
        </div>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="bg-white/[0.03] border border-white/10 rounded-xl px-4 text-sm capitalize">
          <option value="all">All Platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-white/[0.03] border border-white/10 rounded-xl px-4 text-sm capitalize">
          <option value="all">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Heart} title="No donations yet" subtitle="Donations will appear here once people start contributing." action={<Link to="/discover"><Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] gap-2 rounded-xl">Browse Campaigns</Button></Link>} />
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-stone-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Donor</th>
                  <th className="text-left px-4 py-3 font-medium">Campaign</th>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('amount')}>Amount <ArrowUpDown className="inline w-3 h-3" /></th>
                  <th className="text-left px-4 py-3 font-medium capitalize">Platform</th>
                  <th className="text-left px-4 py-3 font-medium">Message</th>
                  <th className="text-left px-4 py-3 font-medium capitalize">Status</th>
                  <th className="text-left px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('date')}>Date <ArrowUpDown className="inline w-3 h-3" /></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">{d.anonymous ? 'Anonymous' : (d.donor_name || '—')}</td>
                    <td className="px-4 py-3 text-stone-400">{d.campaign_title || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-300">{formatMoney(d.amount, d.currency)}</td>
                    <td className="px-4 py-3 text-stone-400 capitalize">{d.platform || 'direct'}</td>
                    <td className="px-4 py-3 text-stone-400 max-w-[200px] truncate">{d.message || '—'}</td>
                    <td className="px-4 py-3"><span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full', d.status === 'paid' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300')}>{d.status}</span></td>
                    <td className="px-4 py-3 text-stone-400">{new Date(d.created_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{d.anonymous ? 'Anonymous' : (d.donor_name || '—')}</p>
                    <p className="text-xs text-stone-500">{d.campaign_title}</p>
                  </div>
                  <span className="font-semibold text-emerald-300">{formatMoney(d.amount, d.currency)}</span>
                </div>
                {d.message && <p className="text-xs text-stone-400 mb-2">"{d.message}"</p>}
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span className="capitalize">{d.platform || 'direct'}</span>
                  <span className={cn('px-2 py-0.5 rounded-full', d.status === 'paid' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300')}>{d.status}</span>
                  <span>{new Date(d.created_date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <footer className="mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-stone-600">Kindred — AI-Powered Fundraising OS · © 2026</p>
      </footer>
    </div>
  );
}