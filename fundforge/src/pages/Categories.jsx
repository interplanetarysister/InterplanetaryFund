import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { HeartPulse, GraduationCap, CloudRain, PawPrint, Users, Flame, Briefcase, Palette, Gift, Sparkles, Loader2, TrendingUp } from 'lucide-react';
import SEO from '@/components/seo/SEO';

const categoryMeta = [
  { key: 'medical', label: 'Medical', icon: HeartPulse, accent: 'from-rose-400 to-pink-500' },
  { key: 'education', label: 'Education', icon: GraduationCap, accent: 'from-sky-400 to-blue-500' },
  { key: 'disaster-relief', label: 'Disaster Relief', icon: CloudRain, accent: 'from-amber-400 to-orange-500' },
  { key: 'animals', label: 'Animals', icon: PawPrint, accent: 'from-emerald-400 to-teal-500' },
  { key: 'community', label: 'Community', icon: Users, accent: 'from-violet-400 to-purple-500' },
  { key: 'memorial', label: 'Memorial', icon: Flame, accent: 'from-orange-400 to-red-500' },
  { key: 'business', label: 'Business', icon: Briefcase, accent: 'from-slate-300 to-stone-400' },
  { key: 'creative', label: 'Creative', icon: Palette, accent: 'from-fuchsia-400 to-pink-500' },
  { key: 'charity', label: 'Charity', icon: Gift, accent: 'from-emerald-400 to-green-500' },
  { key: 'other', label: 'Other', icon: Sparkles, accent: 'from-teal-400 to-cyan-500' },
];

export default function Categories() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await base44.entities.Campaign.list('-created_date', 200);
        setCampaigns(c);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const m = {};
    campaigns.forEach((c) => {
      const k = c.category || 'other';
      if (!m[k]) m[k] = { count: 0, raised: 0 };
      m[k].count += 1;
      m[k].raised += c.raised || 0;
    });
    return m;
  }, [campaigns]);

  const maxCount = Math.max(...Object.values(stats).map((s) => s.count), 0);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <SEO title="Categories · Kindred" description="Browse fundraising campaigns by category on Kindred." />
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Explore by Cause</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Categories</h1>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-32 rounded-2xl bg-white/[0.02] animate-pulse" />)}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryMeta.map((cat) => {
            const s = stats[cat.key] || { count: 0, raised: 0 };
            const trending = s.count === maxCount && s.count > 0;
            return (
              <button key={cat.key} onClick={() => navigate(`/discover?category=${cat.key}`)} className="text-left rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-1 transition-all p-5 relative">
                {trending && (
                  <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400 text-[#0B0F0E] font-semibold flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> Trending</span>
                )}
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cat.accent} flex items-center justify-center mb-4 shadow-lg`}>
                  <cat.icon className="w-5 h-5 text-[#0B0F0E]" strokeWidth={2.5} />
                </div>
                <h3 className="font-medium mb-1">{cat.label}</h3>
                <p className="text-xs text-stone-500">{s.count} campaign{s.count !== 1 ? 's' : ''} · ${s.raised.toLocaleString()} raised</p>
              </button>
            );
          })}
        </div>
      )}

      <footer className="mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-stone-600">Kindred — AI-Powered Fundraising OS · © 2026</p>
      </footer>
    </div>
  );
}