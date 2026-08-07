import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, BarChart3, PieChart as PieIcon, Trophy, Loader2 } from 'lucide-react';

const palette = ['#34d399', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf', '#facc15', '#60a5fa', '#c084fc'];
const tooltipStyle = { background: '#0E1311', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#e7e5e4', fontSize: 12 };

export default function Analytics() {
  const [donations, setDonations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [d, c] = await Promise.all([
          base44.entities.Donation.list('-created_date', 500),
          base44.entities.Campaign.list('-created_date', 200),
        ]);
        setDonations(d);
        setCampaigns(c);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byDate = useMemo(() => {
    const m = {};
    donations.forEach((d) => {
      const dt = new Date(d.created_date);
      const key = dt.toISOString().slice(0, 10);
      if (!m[key]) m[key] = { ts: dt.getTime(), label: dt.toLocaleDateString('en', { month: 'short', day: 'numeric' }), amount: 0 };
      m[key].amount += d.amount || 0;
    });
    return Object.values(m).sort((a, b) => a.ts - b.ts).slice(-14).map(({ label, amount }) => ({ label, amount }));
  }, [donations]);

  const byPlatform = useMemo(() => {
    const m = {};
    donations.forEach((d) => { const k = d.platform || 'direct'; m[k] = (m[k] || 0) + (d.amount || 0); });
    return Object.entries(m).map(([platform, amount]) => ({ platform, amount }));
  }, [donations]);

  const byCategory = useMemo(() => {
    const m = {};
    campaigns.forEach((c) => { const k = c.category || 'other'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [campaigns]);

  const topDonors = useMemo(() => {
    const m = {};
    donations.forEach((d) => {
      if (!d.donor_name) return;
      if (!m[d.donor_name]) m[d.donor_name] = { name: d.donor_name, total: 0, count: 0, last: 0 };
      m[d.donor_name].total += d.amount || 0;
      m[d.donor_name].count += 1;
      const ts = new Date(d.created_date).getTime();
      if (ts > m[d.donor_name].last) m[d.donor_name].last = ts;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [donations]);

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="w-6 h-6 text-stone-500 animate-spin" /></div>;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2">Insights</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Analytics</h1>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Donations Over Time</h2>
        </div>
        {byDate.length === 0 ? <p className="text-sm text-stone-500 py-12 text-center">No donation data yet.</p> : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDate} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(52,211,153,0.2)' }} />
              <Line type="monotone" dataKey="amount" stroke="#34d399" strokeWidth={2.5} dot={{ fill: '#34d399', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <h2 className="font-semibold">Donations by Platform</h2>
          </div>
          {byPlatform.length === 0 ? <p className="text-sm text-stone-500 py-12 text-center">No data.</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byPlatform} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="platform" stroke="#78716c" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {byPlatform.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-5">
            <PieIcon className="w-4 h-4 text-pink-400" />
            <h2 className="font-semibold">Campaigns by Category</h2>
          </div>
          {byCategory.length === 0 ? <p className="text-sm text-stone-500 py-12 text-center">No data.</p> : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {byCategory.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {byCategory.map((c, i) => (
                  <span key={c.name} className="flex items-center gap-1.5 text-[11px] text-stone-400 capitalize">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: palette[i % palette.length] }} /> {c.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 mb-5">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold">Top Donors</h2>
        </div>
        {topDonors.length === 0 ? <p className="text-sm text-stone-500 py-8 text-center">No donors yet.</p> : (
          <div className="space-y-2">
            {topDonors.map((d, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.03] last:border-0">
                <span className="w-6 text-center text-sm font-semibold text-stone-500">{i + 1}</span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold text-sm">{d.name[0]?.toUpperCase()}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-stone-500">{d.count} donations</p>
                </div>
                <span className="text-sm font-semibold text-emerald-300">${d.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-12 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-stone-600">Kindred — AI-Powered Fundraising OS · © 2026</p>
      </footer>
    </div>
  );
}