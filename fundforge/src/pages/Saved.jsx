import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import CampaignCard from '@/components/campaigns/CampaignCard';
import CampaignCardSkeleton from '@/components/campaigns/CampaignCardSkeleton';
import EmptyState from '@/components/campaigns/EmptyState';
import { Bookmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/seo/SEO';

export default function Saved() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        const saved = await base44.entities.SavedCampaign.filter({ user_id: me.id }, '-created_date', 200);
        const ids = saved.map((s) => s.campaign_id);
        if (ids.length === 0) {
          setCampaigns([]);
          return;
        }
        const all = await base44.entities.Campaign.list('-created_date', 200);
        const order = new Map(saved.map((s) => [s.campaign_id, s.created_date]));
        setCampaigns(all.filter((c) => ids.includes(c.id)).sort((a, b) => new Date(order.get(b.id)) - new Date(order.get(a.id))));
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <SEO title="Saved Campaigns · Kindred" description="Your bookmarked Kindred campaigns." />
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Bookmarks</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Saved Campaigns</h1>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{[1, 2, 3].map((i) => <CampaignCardSkeleton key={i} />)}</div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon={Bookmark} title="No saved campaigns" subtitle="Tap the bookmark icon on any campaign to save it for later." action={<Link to="/discover"><Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] gap-2 rounded-xl">Browse Campaigns</Button></Link>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </div>
  );
}