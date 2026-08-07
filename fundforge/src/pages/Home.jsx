import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PlusCircle, TrendingUp, DollarSign, Heart, Target, Sparkles } from 'lucide-react';
import CampaignCard from '@/components/campaigns/CampaignCard';
import CampaignCardSkeleton from '@/components/campaigns/CampaignCardSkeleton';
import EmptyState from '@/components/campaigns/EmptyState';
import SEO from '@/components/seo/SEO';
import { convert, formatGlobal } from '@/utils/currency';
import RecommendationsSection from '@/components/campaigns/RecommendationsSection';
import RecentActivity from '@/components/campaigns/RecentActivity';
import FeaturedCarousel from '@/components/campaigns/FeaturedCarousel';
import SuccessStories from '@/components/campaigns/SuccessStories';

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, d] = await Promise.all([
          base44.entities.Campaign.list('-created_date', 50),
          base44.entities.Donation.list('-created_date', 100),
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

  const totalRaised = donations.reduce((s, d) => s + convert(d.amount, d.currency), 0);
  const activeCount = campaigns.filter((c) => c.status === 'active').length;
  const donorCount = new Set(donations.map((d) => d.donor_name)).size;
  const avgProgress = campaigns.length
    ? campaigns.reduce((s, c) => s + (c.goal ? Math.min(100, ((c.raised || 0) / c.goal) * 100) : 0), 0) / campaigns.length
    : 0;

  const donorCounts = useMemo(() => {
    const m = {};
    donations.forEach((d) => { m[d.campaign_id] = (m[d.campaign_id] || 0) + 1; });
    return m;
  }, [donations]);

  const activeCampaigns = campaigns.filter((c) => c.status === 'active');

  const stats = [
    { label: 'Total Raised', value: formatGlobal(totalRaised), icon: DollarSign, accent: 'from-emerald-400 to-teal-500' },
    { label: 'Active Campaigns', value: activeCount, icon: TrendingUp, accent: 'from-sky-400 to-blue-500' },
    { label: 'Total Donors', value: donorCount, icon: Heart, accent: 'from-rose-400 to-pink-500' },
    { label: 'Avg Goal Progress', value: `${avgProgress.toFixed(0)}%`, icon: Target, accent: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <SEO title="Dashboard · Kindred" description="Your Kindred fundraising dashboard — campaigns, donations, and insights." />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Your Fundraising Hub</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <Link to="/create">
          <Button className="bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-[#0B0F0E] font-medium gap-2 rounded-xl px-5">
            <Sparkles className="w-4 h-4" /> Create New Campaign
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${s.accent} flex items-center justify-center mb-3 shadow-lg`}>
              <s.icon className="w-4 h-4 text-[#0B0F0E]" strokeWidth={2.5} />
            </div>
            <p className="text-2xl font-semibold tracking-tight">{loading ? '—' : s.value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <FeaturedCarousel />

      <RecommendationsSection />

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold tracking-tight">Active Campaigns</h2>
        <Link to="/discover" className="text-xs text-emerald-300 hover:text-emerald-200">View all →</Link>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => <CampaignCardSkeleton key={i} />)}
        </div>
      ) : activeCampaigns.length === 0 ? (
        <EmptyState
          icon={PlusCircle}
          title="No campaigns yet"
          subtitle="Create your first campaign to start raising funds."
          action={<Link to="/create"><Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 rounded-xl"><Sparkles className="w-4 h-4" /> Create Campaign</Button></Link>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeCampaigns.map((c) => <CampaignCard key={c.id} campaign={c} donorCount={donorCounts[c.id] || 0} />)}
        </div>
      )}

      <SuccessStories />

      <RecentActivity />

      <footer className="mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-stone-600">Kindred — AI-Powered Fundraising OS · © 2026</p>
      </footer>
    </div>
  );
}