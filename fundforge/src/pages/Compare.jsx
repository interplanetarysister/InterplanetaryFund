import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useComparison } from '@/hooks/useComparison';
import { Link } from 'react-router-dom';
import { X, GitCompare, ArrowLeft, Trash2 } from 'lucide-react';
import { formatMoney } from '@/utils/currency';
import SEO from '@/components/seo/SEO';
import { Button } from '@/components/ui/button';
import TrustBadge from '@/components/campaigns/TrustBadge';

export default function Compare() {
  const { ids, remove, clear } = useComparison();
  const [campaigns, setCampaigns] = useState([]);
  const [donations, setDonations] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [all, dons, ups] = await Promise.all([
          base44.entities.Campaign.list('-created_date', 200),
          base44.entities.Donation.list('-created_date', 200),
          base44.entities.CampaignUpdate.list('-created_date', 200),
        ]);
        setCampaigns(all.filter((c) => ids.includes(c.id)));
        setDonations(dons);
        setUpdates(ups);
      } catch {} finally { setLoading(false); }
    })();
  }, [ids.join(',')]);

  const backers = (cid) => donations.filter((d) => d.campaign_id === cid).length;
  const updatesCount = (cid) => updates.filter((u) => u.campaign_id === cid).length;
  const progress = (c) => (c.goal ? Math.min(100, ((c.raised || 0) / c.goal) * 100).toFixed(0) : 0);

  const rows = [
    { label: 'Category', get: (c) => <span className="capitalize">{(c.category || '').replace('-', ' ')}</span> },
    { label: 'Status', get: (c) => <span className="capitalize">{c.status}</span> },
    { label: 'Goal', get: (c) => formatMoney(c.goal, c.currency) },
    { label: 'Raised', get: (c) => <span className="font-semibold text-emerald-300">{formatMoney(c.raised, c.currency)}</span> },
    { label: 'Progress', get: (c) => `${progress(c)}%` },
    { label: 'Backers', get: (c) => backers(c.id) },
    { label: 'Updates', get: (c) => updatesCount(c.id) },
    { label: 'Creator', get: (c) => c.organizer_name || '—' },
    { label: 'Trust', get: (c) => <TrustBadge donorCount={backers(c.id)} /> },
    { label: 'Verified', get: (c) => (c.verified ? 'Yes' : 'No') },
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto pb-20 md:pb-10">
      <SEO title="Compare Campaigns · Kindred" description="Compare Kindred campaigns side by side." />
      <Link to="/discover" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-emerald-300 mb-4"><ArrowLeft className="w-3.5 h-3.5" /> Back to campaigns</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight flex items-center gap-2"><GitCompare className="w-7 h-7 text-emerald-400" /> Compare Campaigns</h1>
        {campaigns.length > 0 && <Button onClick={clear} variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl"><Trash2 className="w-4 h-4" /> Clear all</Button>}
      </div>
      {loading ? (
        <div className="h-64 rounded-2xl bg-white/[0.02] animate-pulse" />
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-white/10">
          <GitCompare className="w-10 h-10 text-stone-700 mx-auto mb-3" />
          <p className="font-medium mb-1">No campaigns to compare</p>
          <p className="text-sm text-stone-500 mb-5">Add up to 3 campaigns using the compare icon.</p>
          <Link to="/discover"><Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] rounded-xl">Browse Campaigns</Button></Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-xs uppercase tracking-wider text-stone-500 w-32">Campaign</th>
                {campaigns.map((c) => (
                  <th key={c.id} className="text-left p-4 align-top min-w-[180px]">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/campaign/${c.id}`} className="text-sm font-medium hover:text-emerald-300 line-clamp-2">{c.title}</Link>
                      <button onClick={() => remove(c.id)} className="text-stone-500 hover:text-rose-400 shrink-0" aria-label="Remove from comparison"><X className="w-4 h-4" /></button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-white/[0.03] last:border-0">
                  <td className="p-4 text-xs text-stone-500">{r.label}</td>
                  {campaigns.map((c) => (
                    <td key={c.id} className="p-4 text-sm">{r.get(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}