import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, PlusCircle, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import CampaignCard from '@/components/campaigns/CampaignCard';
import CampaignCardSkeleton from '@/components/campaigns/CampaignCardSkeleton';
import EmptyState from '@/components/campaigns/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import SEO from '@/components/seo/SEO';

const categories = [
  { key: 'all', label: 'All' },
  { key: 'medical', label: 'Medical' },
  { key: 'education', label: 'Education' },
  { key: 'disaster-relief', label: 'Disaster Relief' },
  { key: 'animals', label: 'Animals' },
  { key: 'community', label: 'Community' },
  { key: 'memorial', label: 'Memorial' },
  { key: 'business', label: 'Business' },
  { key: 'creative', label: 'Creative' },
  { key: 'charity', label: 'Charity' },
  { key: 'other', label: 'Other' },
];
const statuses = ['all', 'active', 'funded', 'closed', 'draft'];

export default function Discover() {
  const [campaigns, setCampaigns] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('category') || 'all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('new');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    (async () => {
      try {
        const [c, d] = await Promise.all([
          base44.entities.Campaign.list('-created_date', 100),
          base44.entities.Donation.list('-created_date', 200),
        ]);
        setCampaigns(c);
        setDonations(d);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const donorCounts = useMemo(() => {
    const m = {};
    donations.forEach((d) => { m[d.campaign_id] = (m[d.campaign_id] || 0) + 1; });
    return m;
  }, [donations]);

  const filtered = useMemo(() => {
    let list = campaigns;
    if (category !== 'all') list = list.filter((c) => c.category === category);
    if (status !== 'all') list = list.filter((c) => c.status === status);
    if (verifiedOnly) list = list.filter((c) => c.verified);
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter((c) => (c.title || '').toLowerCase().includes(q) || (c.beneficiary || '').toLowerCase().includes(q));
    }
    if (sort === 'new') list = [...list].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    if (sort === 'funded') list = [...list].sort((a, b) => (b.raised || 0) - (a.raised || 0));
    if (sort === 'urgent') list = [...list].sort((a, b) => (a.goal - (a.raised || 0)) - (b.goal - (b.raised || 0)));
    list = [...list].sort((a, b) => (!!b.verified) - (!!a.verified));
    return list;
  }, [campaigns, debouncedQuery, category, status, sort, verifiedOnly]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <SEO title="Discover Campaigns · Kindred" description="Browse and support active fundraising campaigns on Kindred." />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Browse Causes</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Discover Campaigns</h1>
        </div>
        <Link to="/create">
          <Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 rounded-xl"><Sparkles className="w-4 h-4" /> Create</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or beneficiary…" className="pl-10 bg-white/[0.03] border-white/10 rounded-xl" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-white/[0.03] border border-white/10 rounded-xl px-4 text-sm">
          <option value="new">Newest</option>
          <option value="funded">Most Funded</option>
          <option value="urgent">Most Urgent</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map((c) => (
          <button key={c.key} onClick={() => setCategory(c.key)} className={cn('px-3.5 py-1.5 rounded-full text-xs font-medium transition-all', category === c.key ? 'bg-emerald-400 text-[#0B0F0E]' : 'bg-white/[0.04] text-stone-400 hover:text-stone-200 hover:bg-white/[0.08]')}>{c.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {statuses.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn('px-3 py-1 rounded-full text-[11px] font-medium capitalize transition-all', status === s ? 'bg-white/15 text-white' : 'bg-white/[0.03] text-stone-500 hover:text-stone-300')}>{s}</button>
        ))}
        <button onClick={() => setVerifiedOnly(!verifiedOnly)} className={cn('px-3 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1', verifiedOnly ? 'bg-sky-400 text-[#0B0F0E]' : 'bg-white/[0.03] text-stone-500 hover:text-stone-300')}>✓ Verified</button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[1, 2, 3, 4, 5, 6].map((i) => <CampaignCardSkeleton key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={PlusCircle} title="No campaigns found" subtitle="Try adjusting your search or filters, or create a new campaign." action={<Link to="/create"><Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 rounded-xl"><Sparkles className="w-4 h-4" /> Create Campaign</Button></Link>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => <CampaignCard key={c.id} campaign={c} donorCount={donorCounts[c.id] || 0} />)}
        </div>
      )}

      <footer className="mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-stone-600">Kindred — AI-Powered Fundraising OS · © 2026</p>
      </footer>
    </div>
  );
}