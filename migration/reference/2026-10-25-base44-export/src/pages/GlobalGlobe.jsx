import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import CampaignGlobe from "@/components/globe/CampaignGlobe";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import BrandLogo from "@/components/brand/BrandLogo";
import { Loader2, Globe2, MapPin, X } from "lucide-react";
import PageError from "@/components/PageError";

const SAFE_GLOBE_ERROR = "We couldn't load the globe right now. Please try again.";
const MAX_CAMPAIGNS = 200;

// Public global activity surface: an interactive 3D globe of every active
// campaign that has a city location. Tap a pin to open a quick card, then jump
// to the full campaign. A list below keeps everything accessible without WebGL.
export default function GlobalGlobe() {
  const [campaigns, setCampaigns] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const requestId = ++requestRef.current;
    setError(null);
    setCampaigns(null);

    (async () => {
      try {
        const result = await base44.entities.Campaign.filter({ status: "active" }, "-raised_amount", MAX_CAMPAIGNS);
        if (!Array.isArray(result) || result.length > MAX_CAMPAIGNS) throw new Error("invalid-campaign-payload");
        if (mountedRef.current && requestRef.current === requestId) setCampaigns(result);
      } catch {
        if (mountedRef.current && requestRef.current === requestId) {
          setCampaigns(null);
          setError(SAFE_GLOBE_ERROR);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [refreshKey]);

  const withCoords = (campaigns || []).filter(
    (c) => c && typeof c.location_lat === "number" && Number.isFinite(c.location_lat)
      && typeof c.location_lng === "number" && Number.isFinite(c.location_lng)
  );

  return (
    <div className="ifund-public ifund-experience min-h-dvh bg-background">
      <header className="deep-space px-4 sm:px-6 py-4 pt-safe">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="shrink-0"><BrandLogo size="sm" nameClassName="text-slate-100 text-[15px]" /></Link>
          <div className="flex items-center gap-2 text-slate-200">
            <Globe2 className="w-4 h-4 text-cyan-400" />
            <span className="font-display text-sm hidden sm:block">Global Activity</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs text-cyan-300 hover:text-cyan-200">Home</Link>
            <Link to="/discover" className="text-xs text-cyan-300 hover:text-cyan-200">Browse campaigns →</Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center mb-5">
          <h1 className="font-display text-3xl sm:text-4xl text-foreground">Campaigns across the planet</h1>
          <p className="text-stone-500 mt-1">Drag the globe to explore. Tap a glowing pin to discover a campaign happening there.</p>
        </div>

        {error ? (
          <PageError message={error} onRetry={() => { setError(null); setRefreshKey((value) => value + 1); }} />
        ) : !campaigns ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : withCoords.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
            No campaigns have locations yet. Add a city when you create a campaign to see it on the globe.
          </div>
        ) : (
          <div className="relative rounded-3xl overflow-hidden border border-stone-200 bg-gradient-to-b from-slate-950 to-indigo-950 shadow-xl">
            <CampaignGlobe campaigns={campaigns} onSelect={setSelected} />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs text-cyan-200 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
              <MapPin className="w-3.5 h-3.5" /> {withCoords.length} active campaigns
            </div>
          </div>
        )}

        {selected && (
          <div className="mt-4 bg-white rounded-2xl border border-stone-200 shadow-lg p-4 flex flex-col sm:flex-row gap-4 animate-fade-up">
            <Image src={selected.cover_image_url || FALLBACK_IMAGE} alt={selected.title} className="w-full sm:w-28 h-28 rounded-xl object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              {selected.location && <p className="flex items-center gap-1 text-xs text-stone-500 mb-1"><MapPin className="w-3 h-3" />{selected.location}</p>}
              <h3 className="font-display text-lg text-stone-900">{selected.title}</h3>
              {selected.summary && <p className="text-sm text-stone-500 line-clamp-2">{selected.summary}</p>}
              <Link to={`/campaign/${selected.id}`} className="inline-block mt-2 text-sm font-medium text-primary hover:underline">View campaign →</Link>
            </div>
            <button onClick={() => setSelected(null)} className="self-start text-stone-400 hover:text-stone-600" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
        )}

        {campaigns && withCoords.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl text-foreground mb-4">All locations</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {withCoords.map((c) => <CampaignCard key={c.id} campaign={c} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
