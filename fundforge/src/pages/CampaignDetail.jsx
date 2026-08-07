import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Heart, Share2, MapPin, Clock, Users, User, Sparkles, Loader2, ChevronDown, BadgeCheck, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import DonationModal from '@/components/campaigns/DonationModal';
import VerifiedBadge from '@/components/campaigns/VerifiedBadge';
import CampaignUpdates from '@/components/campaigns/CampaignUpdates';
import { formatMoney, currencySymbol } from '@/utils/currency';
import { useCountUp } from '@/hooks/useCountUp';
import SaveButton from '@/components/campaigns/SaveButton';
import CompareButton from '@/components/campaigns/CompareButton';
import TrustBadge from '@/components/campaigns/TrustBadge';
import confetti from 'canvas-confetti';
import ShareModal from '@/components/campaigns/ShareModal';
import Timeline from '@/components/campaigns/Timeline';
import LazyImage from '@/components/campaigns/LazyImage';
import SEO from '@/components/seo/SEO';

function parseFaq(faq) {
  if (!faq) return [];
  const parts = faq.split(/\n(?=Q[:.\s])/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return [{ q: 'Frequently Asked Questions', a: faq.trim() }];
  return parts.map((p) => {
    const m = p.match(/^Q[:.\s]*(.*?)\n+A[:.\s]*(.*)$/is);
    return m ? { q: m[1].trim(), a: m[2].trim() } : { q: p, a: '' };
  });
}

export default function CampaignDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [notFoundQuery, setNotFoundQuery] = useState('');
  const [user, setUser] = useState(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [c, d] = await Promise.all([
          base44.entities.Campaign.get(id),
          base44.entities.Donation.filter({ campaign_id: id }, '-created_date', 100),
        ]);
        setCampaign(c);
        setDonations(d);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!campaign) return;
    base44.entities.Follow.filter({ campaign_id: campaign.id }, '-created_date', 500).then((f) => {
      setFollowerCount(f.length);
      base44.auth.me().then((u) => setFollowing(f.some((x) => x.follower_id === u.id))).catch(() => {});
    }).catch(() => {});
  }, [campaign]);

  useEffect(() => {
    if ([25, 50, 75, 100].some((m) => pct >= m)) {
      try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } }); } catch {}
    }
  }, []);

  useEffect(() => {
    if (campaign) {
      document.title = campaign.title ? `${campaign.title} · Kindred` : 'Kindred';
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
      meta.content = campaign.seo_content || campaign.short_description || '';
    }
  }, [campaign]);

  const animatedRaised = useCountUp(campaign?.raised || 0);

  if (loading) {
    return <div className="p-20 flex justify-center"><Loader2 className="w-6 h-6 text-stone-500 animate-spin" /></div>;
  }
  if (!campaign) {
    return (
      <div className="p-10 text-center max-w-md mx-auto">
        <p className="text-6xl font-semibold text-stone-700 mb-2">404</p>
        <p className="font-medium text-lg mb-1">Campaign not found</p>
        <p className="text-sm text-stone-500 mb-5">This campaign may have been removed. Try searching for another cause.</p>
        <div className="flex gap-2 mb-4">
          <Input value={notFoundQuery} onChange={(e) => setNotFoundQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/discover?q=${encodeURIComponent(notFoundQuery)}`)} placeholder="Search campaigns…" className="bg-white/[0.03] border-white/10 rounded-xl" />
          <Button onClick={() => navigate(`/discover?q=${encodeURIComponent(notFoundQuery)}`)} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] rounded-xl">Search</Button>
        </div>
        <Link to="/discover"><Button variant="outline" className="border-white/10 bg-white/[0.03] rounded-xl">Browse all</Button></Link>
      </div>
    );
  }

  const pct = campaign.goal ? Math.min(100, ((campaign.raised || 0) / campaign.goal) * 100) : 0;
  const donorCount = donations.length;
  const lastHour = donations.filter((d) => Date.now() - new Date(d.created_date).getTime() < 3600000).length;
  const isLive = donations.some((d) => Date.now() - new Date(d.created_date).getTime() < 300000);
  const topDonors = Object.values(donations.reduce((m, d) => {
    const n = d.anonymous ? 'Anonymous' : (d.donor_name || 'Supporter');
    if (!m[n]) m[n] = { name: n, total: 0 };
    m[n].total += d.amount || 0;
    return m;
  }, {})).sort((a, b) => b.total - a.total).slice(0, 5);
  const faqItems = parseFaq(campaign.faq);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: campaign.title,
    description: campaign.short_description || campaign.description,
    image: campaign.image_url ? [campaign.image_url] : undefined,
    url: typeof window !== 'undefined' ? window.location.href : '',
    startDate: new Date(campaign.created_date).toISOString(),
    location: campaign.location ? { '@type': 'Place', name: campaign.location } : undefined,
    organizer: campaign.organizer_name ? { '@type': 'Organization', name: campaign.organizer_name } : undefined,
  };

  const toggleFollow = async () => {
    try {
      const res = await base44.functions.invoke('manageFollow', { campaign_id: campaign.id, campaign_title: campaign.title });
      setFollowing(res?.data?.following);
      setFollowerCount(res?.data?.count ?? followerCount);
    } catch (e) { toast({ title: 'Could not update follow', variant: 'destructive' }); }
  };

  const requestVerification = async () => {
    try {
      await base44.entities.Campaign.update(campaign.id, { verification_status: 'pending' });
      setCampaign({ ...campaign, verification_status: 'pending' });
      toast({ title: 'Verification requested', variant: 'success' });
      setVerifyOpen(false);
    } catch (e) { toast({ title: 'Failed', variant: 'destructive' }); }
  };

  const isCreator = user && campaign.created_by_id === user.id;

  return (
    <div className="pb-28 sm:pb-0">
      <SEO title={`${campaign.title} · Kindred`} description={campaign.short_description || campaign.description} image={campaign.image_url} jsonLd={jsonLd} />
      {/* Hero */}
      <div className="relative h-72 md:h-96 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">
        {campaign.image_url && <LazyImage src={campaign.image_url} alt={campaign.title} className="absolute inset-0" imgClassName="object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F0E] via-[#0B0F0E]/50 to-transparent" />
        <Link to="/discover" className="absolute top-5 left-5 flex items-center gap-1.5 text-sm text-stone-200 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full z-10">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        {campaign.is_featured && (
          <span className="absolute top-5 right-5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-400 text-[#0B0F0E] font-semibold flex items-center gap-1 z-10">
            <Sparkles className="w-3 h-3" /> Featured
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-3xl">
            <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-400 text-[#0B0F0E] font-semibold capitalize">{campaign.category?.replace('-', ' ')}</span>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight mt-3 leading-tight flex items-center gap-2 flex-wrap">{campaign.title} {campaign.verified && <VerifiedBadge />}</h1>
          </div>
        </div>
      </div>

      <div className="px-6 md:px-10 max-w-6xl mx-auto -mt-8 relative">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left */}
          <div className="lg:col-span-2 space-y-8">
            <p className="text-stone-300 leading-relaxed">{campaign.short_description}</p>
            <div className="flex flex-wrap gap-4 text-xs text-stone-500">
              {campaign.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {campaign.location}</span>}
              {campaign.beneficiary && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {campaign.beneficiary}</span>}
              {campaign.organizer_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> by {campaign.organizer_name}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(campaign.created_date).toLocaleDateString()}</span>
            </div>

            {campaign.timeline && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Timeline & Milestones</h2>
                <Timeline timeline={campaign.timeline} campaignId={campaign.id} />
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold mb-3">The Story</h2>
              <div className="text-sm text-stone-300 leading-relaxed whitespace-pre-wrap">{campaign.story || campaign.description}</div>
            </section>

            {campaign.faq && (
              <section>
                <h2 className="text-lg font-semibold mb-3">FAQ</h2>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4">
                  {faqItems.map((item, i) => (
                    <div key={i} className="border-b border-white/5 last:border-0">
                      <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between py-4 text-left text-sm font-medium">
                        {item.q}
                        <ChevronDown className={cn('w-4 h-4 text-stone-500 transition-transform shrink-0 ml-2', openFaq === i && 'rotate-180')} />
                      </button>
                      {openFaq === i && <p className="pb-4 text-sm text-stone-400 whitespace-pre-wrap leading-relaxed">{item.a || item.q}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <CampaignUpdates campaign={campaign} />

            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-emerald-400" /> Donors ({donorCount})</h2>
              {donations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-stone-500">Be the first to support this cause.</div>
              ) : (
                <div className="space-y-3">
                  {donations.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-4 border border-white/5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold text-sm shrink-0">
                        {d.anonymous ? '?' : (d.donor_name?.[0]?.toUpperCase() || '?')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            {d.anonymous ? 'Anonymous' : (d.donor_name || 'Supporter')}
                            {d.anonymous && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/10 text-stone-400">anon</span>}
                          </p>
                          <span className="text-sm font-semibold text-emerald-300">{formatMoney(d.amount, d.currency)}</span>
                        </div>
                        {d.message && <p className="text-xs text-stone-400 mt-1">"{d.message}"</p>}
                        <p className="text-[10px] text-stone-500 mt-1">{new Date(d.created_date).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {topDonors.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Campaign Backed By</h2>
                <div className="flex items-center gap-2">
                  {topDonors.map((d, i) => (
                    <div key={i} className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold text-sm border-2 border-[#0B0F0E]" title={`${d.name} · ${formatMoney(d.total, campaign.currency)}`}>{d.name[0]?.toUpperCase()}</div>
                  ))}
                </div>
              </section>
            )}

            {(campaign.social_captions || campaign.press_release) && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Updates & Outreach</h2>
                <div className="space-y-4">
                  {campaign.social_captions && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-emerald-400 mb-1.5 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Social Captions</p>
                      <div className="text-sm text-stone-300 whitespace-pre-wrap rounded-xl bg-white/[0.03] p-4 border border-white/5">{campaign.social_captions}</div>
                    </div>
                  )}
                  {campaign.press_release && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-emerald-400 mb-1.5">Press Release</p>
                      <div className="text-sm text-stone-300 whitespace-pre-wrap rounded-xl bg-white/[0.03] p-4 border border-white/5">{campaign.press_release}</div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right sticky donate panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-semibold">{formatMoney(animatedRaised, campaign.currency)}</span>
                  <span className="text-sm text-stone-500">of {formatMoney(campaign.goal, campaign.currency)}</span>
                </div>
                <Progress value={pct} className="h-2 mb-2" />
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {donorCount} donors <TrustBadge donorCount={donorCount} /></span>
                  <span>{pct.toFixed(0)}% funded</span>
                </div>
                {isLive && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live · {lastHour} donation{lastHour !== 1 ? 's' : ''} in the last hour</p>
                )}
              </div>

              <Button onClick={() => setModalOpen(true)} className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-[#0B0F0E] font-medium gap-2 rounded-xl h-12 text-base">
                <Heart className="w-4 h-4" /> Donate Now
              </Button>

              <div className="flex gap-2 mt-3">
                <Button onClick={() => setShareOpen(true)} variant="outline" className="flex-1 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] gap-2 rounded-xl">
                  <Share2 className="w-4 h-4" /> Share
                </Button>
                <CompareButton campaign={campaign} className="w-11 h-11 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]" />
                <SaveButton campaign={campaign} className="w-11 h-11 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06]" />
              </div>

              {user && !isCreator && (
                <Button onClick={toggleFollow} variant={following ? 'secondary' : 'outline'} className="w-full mt-3 gap-2 rounded-xl">
                  <UserPlus className="w-4 h-4" /> {following ? 'Following' : 'Follow'} <span className="text-xs text-stone-500">· {followerCount}</span>
                </Button>
              )}

              <div className="flex items-center justify-between text-xs text-stone-500 mt-3">
                <span className="flex items-center gap-1"><UserPlus className="w-3 h-3" /> {followerCount} followers</span>
                {campaign.verified ? (
                  <span className="flex items-center gap-1 text-sky-400"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                ) : isCreator && campaign.verification_status !== 'pending' && (
                  <button onClick={() => setVerifyOpen(true)} className="text-sky-400 hover:underline">Get verified</button>
                )}
              </div>

              {campaign.donor_thank_you && (
                <p className="text-[11px] text-stone-500 mt-5 leading-relaxed text-center italic">"{campaign.donor_thank_you}"</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="sm:hidden fixed bottom-16 inset-x-0 z-30 bg-[#0E1311]/95 backdrop-blur border-t border-white/5 flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs text-stone-400">{formatMoney(campaign.raised, campaign.currency)} raised</p>
          <p className="text-[10px] text-stone-600">{pct.toFixed(0)}% of goal</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] font-medium gap-2 rounded-xl px-6">
          <Heart className="w-4 h-4" /> Donate
        </Button>
      </div>

      {verifyOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setVerifyOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0E1311] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3"><BadgeCheck className="w-5 h-5 text-sky-400" /> <h3 className="font-semibold">Get Verified</h3></div>
            <p className="text-sm text-stone-400 leading-relaxed mb-4">Verified campaigns receive a blue checkmark, priority in search results, and increased trust from donors. Submit a request and our team reviews your campaign and supporting documentation.</p>
            <ul className="text-xs text-stone-500 space-y-1.5 mb-5 list-disc pl-4">
              <li>Complete campaign story and goal</li>
              <li>Verifiable beneficiary information</li>
              <li>Valid organizer identity</li>
            </ul>
            <div className="flex gap-2">
              <Button onClick={requestVerification} className="flex-1 bg-gradient-to-r from-sky-400 to-blue-500 text-[#0B0F0E] rounded-xl">Request Verification</Button>
              <Button onClick={() => setVerifyOpen(false)} variant="outline" className="border-white/10 bg-white/[0.03] rounded-xl">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <DonationModal open={modalOpen} onClose={() => setModalOpen(false)} campaign={campaign} />
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} campaign={campaign} />
    </div>
  );
}