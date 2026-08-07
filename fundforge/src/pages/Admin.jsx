import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { DollarSign, Megaphone, Users, TrendingUp, ShieldCheck, Loader2, Download, Activity, Star } from 'lucide-react';
import { exportToCsv } from '@/utils/exportCsv';
import { cn } from '@/lib/utils';
import { convert, formatGlobal, formatMoney } from '@/utils/currency';
import { useToast } from '@/components/ui/use-toast';
import SEO from '@/components/seo/SEO';

export default function Admin() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
        if (me.role !== 'admin') return;
        const [c, d] = await Promise.all([
          base44.entities.Campaign.list('-created_date', 200),
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

  const totalRaised = donations.reduce((s, d) => s + convert(d.amount, d.currency), 0);
  const donorCount = new Set(donations.map((d) => d.donor_name)).size;
  const avgDonation = donations.length ? totalRaised / donations.length : 0;

  const exportDonations = () => {
    exportToCsv('kindred-donations.csv', donations.map((d) => ({ name: d.donor_name, email: '', amount: d.amount, date: new Date(d.created_date).toLocaleDateString(), campaign: d.campaign_title })));
    toast({ title: 'Donations exported', variant: 'success' });
  };
  const exportCampaigns = () => {
    exportToCsv('kindred-campaigns.csv', campaigns.map((c) => ({ title: c.title, category: c.category, goal: c.goal, raised: c.raised, status: c.status, organizer: c.organizer_name, created: new Date(c.created_date).toLocaleDateString() })));
    toast({ title: 'Campaigns exported', variant: 'success' });
  };

  const approveVerification = async (c) => {
    try {
      const date = new Date().toISOString();
      await base44.entities.Campaign.update(c.id, { verified: true, verification_status: 'approved', verification_date: date });
      setCampaigns(campaigns.map((x) => (x.id === c.id ? { ...x, verified: true, verification_status: 'approved', verification_date: date } : x)));
      toast({ title: 'Campaign verified', variant: 'success' });
    } catch (e) { toast({ title: 'Failed', variant: 'destructive' }); }
  };
  const rejectVerification = async (c) => {
    try {
      await base44.entities.Campaign.update(c.id, { verification_status: 'rejected' });
      setCampaigns(campaigns.map((x) => (x.id === c.id ? { ...x, verification_status: 'rejected' } : x)));
      toast({ title: 'Request rejected', variant: 'success' });
    } catch (e) { toast({ title: 'Failed', variant: 'destructive' }); }
  };
  const toggleFeatured = async (c) => {
    try {
      const val = !c.is_featured;
      await base44.entities.Campaign.update(c.id, { is_featured: val });
      setCampaigns(campaigns.map((x) => (x.id === c.id ? { ...x, is_featured: val } : x)));
      toast({ title: val ? 'Marked as featured' : 'Removed from featured', variant: 'success' });
    } catch (e) { toast({ title: 'Failed', variant: 'destructive' }); }
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="w-6 h-6 text-stone-500 animate-spin" /></div>;

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-10 text-center max-w-md mx-auto">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5"><ShieldCheck className="w-6 h-6 text-amber-400" /></div>
        <h1 className="text-xl font-semibold mb-2">Admin access required</h1>
        <p className="text-sm text-stone-500 mb-5">You don't have permission to view this page.</p>
        <Link to="/"><Button className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] gap-2 rounded-xl">Back to Dashboard</Button></Link>
      </div>
    );
  }

  const stats = [
    { label: 'Total Raised', value: formatGlobal(totalRaised), icon: DollarSign, accent: 'from-emerald-400 to-teal-500' },
    { label: 'Campaigns', value: campaigns.length, icon: Megaphone, accent: 'from-sky-400 to-blue-500' },
    { label: 'Donors', value: donorCount, icon: Users, accent: 'from-rose-400 to-pink-500' },
    { label: 'Avg Donation', value: formatGlobal(avgDonation), icon: TrendingUp, accent: 'from-amber-400 to-orange-500' },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <SEO title="Admin · Kindred" description="Kindred admin dashboard." />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400 mb-2 flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Admin</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCampaigns} variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl"><Download className="w-4 h-4" /> Export Campaigns</Button>
          <Button onClick={exportDonations} variant="outline" className="border-white/10 bg-white/[0.03] gap-2 rounded-xl"><Download className="w-4 h-4" /> Export Donations</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${s.accent} flex items-center justify-center mb-3 shadow-lg`}><s.icon className="w-4 h-4 text-[#0B0F0E]" strokeWidth={2.5} /></div>
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 mb-6 flex items-center gap-3">
        <Activity className="w-4 h-4 text-emerald-400" />
        <div className="flex-1">
          <p className="text-sm font-medium">API Status</p>
          <p className="text-xs text-stone-500">All systems operational</p>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      {campaigns.filter((c) => c.verification_status === 'pending').length > 0 && (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.03] p-5 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-sky-400" /> Verification Requests</h2>
          <div className="space-y-2">
            {campaigns.filter((c) => c.verification_status === 'pending').map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-2 border-b border-white/[0.03] last:border-0">
                <Link to={`/campaign/${c.id}`} className="text-sm truncate hover:text-sky-300">{c.title}</Link>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={() => approveVerification(c)} size="sm" className="h-7 bg-sky-400 text-[#0B0F0E] rounded-lg">Approve</Button>
                  <Button onClick={() => rejectVerification(c)} size="sm" variant="outline" className="h-7 border-white/10 bg-white/[0.03] rounded-lg">Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-emerald-400" /> Manage Campaigns</h2>
          <div className="space-y-1">
            {campaigns.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-2 border-b border-white/[0.03] last:border-0 -mx-2 px-2 rounded">
                <Link to={`/campaign/${c.id}`} className="text-sm truncate hover:text-emerald-300 flex-1 min-w-0">{c.title}</Link>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => toggleFeatured(c)} title={c.is_featured ? 'Unfeature' : 'Feature'} className="text-stone-500 hover:text-emerald-400 transition-colors">
                    <Star className={cn('w-3.5 h-3.5', c.is_featured && 'fill-emerald-400 text-emerald-400')} />
                  </button>
                  <span className="text-xs text-stone-500 capitalize w-12 text-right">{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="font-semibold mb-4">Recent Donations</h2>
          <div className="space-y-1">
            {donations.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                <span className="text-sm truncate">{d.donor_name}</span>
                <span className="text-sm font-semibold text-emerald-300">{formatMoney(d.amount, d.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-stone-600">Kindred — AI-Powered Fundraising OS · © 2026</p>
      </footer>
    </div>
  );
}