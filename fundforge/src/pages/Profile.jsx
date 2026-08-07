import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';
import { Image } from '@/components/ui/image';
import SEO from '@/components/seo/SEO';
import { Music, Sparkles, Camera, Pencil, Megaphone, Heart, Star } from 'lucide-react';

function CampCard({ c }) {
  const pct = c.goal ? Math.min(100, ((c.raised || 0) / c.goal) * 100) : 0;
  return (
    <Link to={`/campaign/${c.id}`} className="block rounded-xl overflow-hidden border-2 border-fuchsia-500/40 bg-[#1a0b2e] hover:border-fuchsia-400 transition-colors">
      <div className="h-28 bg-white/5 overflow-hidden">
        {c.image_url ? <Image src={c.image_url} alt={c.title} fittingType="fill" className="w-full h-full" /> : <div className="w-full h-full" />}
      </div>
      <div className="p-3">
        <p className="text-xs text-cyan-300 capitalize">{(c.category || '').replace('-', ' ')}</p>
        <p className="text-sm font-bold text-white line-clamp-1">{c.title}</p>
        <p className="text-[10px] text-stone-400 line-clamp-1">by {c.organizer_name || 'Unknown'}</p>
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-stone-300 mb-1">
            <span>${(c.raised || 0).toLocaleString()}</span><span>of ${(c.goal || 0).toLocaleString()}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
      </div>
    </Link>
  );
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [supported, setSupported] = useState([]);
  const [totalDonated, setTotalDonated] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const [posted, donations] = await Promise.all([
          base44.entities.Campaign.filter({ created_by_id: u.id }, '-created_date', 50),
          base44.entities.Donation.filter({ donor_user_id: u.id, status: 'paid' }, '-created_date', 50),
        ]);
        setMyCampaigns(posted);
        setTotalDonated(donations.reduce((s, d) => s + Number(d.amount || 0), 0));
        const ids = [...new Set(donations.map((d) => d.campaign_id).filter(Boolean))];
        const camps = await Promise.all(ids.map((id) => base44.entities.Campaign.get(id).catch(() => null)));
        setSupported(camps.filter(Boolean));
      } catch {
        /* not logged in */
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-10 text-center text-stone-400">Loading your profile…</div>;
  if (!user) return <div className="p-10 text-center text-stone-400">Please log in to view your profile.</div>;

  const name = user.full_name || (user.email ? user.email.split('@')[0] : 'Kindred User');
  const initials = name.slice(0, 1).toUpperCase();
  const comic = { fontFamily: "'Comic Sans MS','Comic Sans',cursive" };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#1a0033 0%,#2d0b4e 40%,#0b1f3a 100%)' }}>
      <SEO title={`${name} · Profile`} description="My Kindred profile" />
      <div className="fixed inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="rounded-2xl border-4 border-yellow-400/60 bg-gradient-to-br from-purple-900/80 to-fuchsia-900/60 p-6 shadow-xl" style={comic}>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative">
              <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-4xl font-black text-white border-4 border-white/80 shadow-lg">{initials}</div>
              <span className="absolute -bottom-2 -right-2 text-[10px] bg-emerald-400 text-black px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" /> Online</span>
            </div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300">{name}</h1>
              <p className="text-sm text-fuchsia-200 mt-1 italic">"{user.email}"</p>
              <p className="text-xs text-cyan-200 mt-2 flex items-center justify-center sm:justify-start gap-1.5"><Sparkles className="w-3 h-3 text-yellow-300" /> Mood: ready to change the world ✨</p>
              <div className="flex gap-2 justify-center sm:justify-start mt-3">
                <Link to="/settings" className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit Profile</Link>
                <Link to="/create" className="text-xs bg-yellow-400 text-black px-3 py-1.5 rounded-full font-bold flex items-center gap-1"><Camera className="w-3 h-3" /> New Post</Link>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2">
            <Music className="w-4 h-4 text-cyan-300 animate-pulse" />
            <span className="text-xs text-cyan-100">♪ Kindred Anthem — "We Rise Together"</span>
            <div className="ml-auto flex items-end gap-0.5 h-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="w-1 bg-cyan-300 rounded-full animate-pulse" style={{ height: '100%', animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl border-2 border-cyan-400/40 bg-black/30 p-4 text-center">
            <Megaphone className="w-5 h-5 text-cyan-300 mx-auto mb-1" />
            <p className="text-2xl font-black text-white">{myCampaigns.length}</p>
            <p className="text-[11px] text-stone-300 uppercase tracking-wide">Campaigns Posted</p>
          </div>
          <div className="rounded-xl border-2 border-fuchsia-400/40 bg-black/30 p-4 text-center">
            <Heart className="w-5 h-5 text-fuchsia-300 mx-auto mb-1" />
            <p className="text-2xl font-black text-white">{supported.length}</p>
            <p className="text-[11px] text-stone-300 uppercase tracking-wide">Campaigns Supported</p>
          </div>
          <div className="rounded-xl border-2 border-yellow-400/40 bg-black/30 p-4 text-center">
            <Star className="w-5 h-5 text-yellow-300 mx-auto mb-1" />
            <p className="text-2xl font-black text-white">${totalDonated.toLocaleString()}</p>
            <p className="text-[11px] text-stone-300 uppercase tracking-wide">Total Donated</p>
          </div>
        </div>

        {/* Top causes */}
        {supported.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-black text-yellow-300 mb-3" style={comic}>★ My Top Causes ★</h2>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {supported.slice(0, 8).map((c) => (
                <Link key={c.id} to={`/campaign/${c.id}`} className="block text-center">
                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-fuchsia-400/50 bg-white/5">
                    {c.image_url ? <Image src={c.image_url} alt={c.title} fittingType="fill" className="w-full h-full" /> : <div className="w-full h-full" />}
                  </div>
                  <p className="text-[9px] text-stone-300 line-clamp-1 mt-1">{c.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Campaigns */}
        <div className="mt-8">
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300 mb-4" style={comic}>My Campaigns</h2>
          {myCampaigns.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-white/15 p-8 text-center text-stone-400">
              <p className="text-sm">You haven't posted any campaigns yet.</p>
              <Link to="/create" className="inline-block mt-3 text-xs bg-emerald-400 text-black font-bold px-4 py-2 rounded-full">Create your first campaign</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCampaigns.map((c) => <CampCard key={c.id} c={c} />)}
            </div>
          )}
        </div>

        {/* Campaigns I Support */}
        <div className="mt-8 mb-12">
          <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-pink-300 mb-4" style={comic}>Campaigns I Support</h2>
          {supported.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-white/15 p-8 text-center text-stone-400">
              <p className="text-sm">You haven't donated to any campaigns yet.</p>
              <Link to="/discover" className="inline-block mt-3 text-xs bg-fuchsia-400 text-black font-bold px-4 py-2 rounded-full">Discover causes</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {supported.map((c) => <CampCard key={c.id} c={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}