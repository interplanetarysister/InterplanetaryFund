import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { CampaignGridSkeleton } from "@/components/mobile/Skeletons";

export default function FeaturedCarousel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const scroller = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.Campaign.filter({ is_featured: true, status: "active" }, "-raised_amount", 6)
      .then((campaigns) => { if (active) setItems(campaigns || []); })
      .catch(() => { if (active) setItems([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="mb-8"><CampaignGridSkeleton count={3} /></div>;
  if (items.length === 0) return null;

  const scroll = (direction) => scroller.current?.scrollBy({ left: direction * 320, behavior: "smooth" });

  return (
    <section className="mb-8" aria-labelledby="featured-campaigns-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="featured-campaigns-heading" className="font-display text-xl text-stone-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-500" /> Featured campaigns
        </h2>
        {items.length > 2 && (
          <div className="flex gap-1">
            <button type="button" onClick={() => scroll(-1)} className="w-9 h-9 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 flex items-center justify-center" aria-label="Previous featured campaigns"><ChevronLeft className="w-4 h-4" /></button>
            <button type="button" onClick={() => scroll(1)} className="w-9 h-9 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 flex items-center justify-center" aria-label="Next featured campaigns"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      <div ref={scroller} className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {items.map((campaign) => (
          <div key={campaign.id} className="w-72 sm:w-80 shrink-0 snap-start">
            <CampaignCard campaign={campaign} />
          </div>
        ))}
      </div>
    </section>
  );
}
