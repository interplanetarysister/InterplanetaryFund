import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Trophy } from "lucide-react";

const money = (value, currency = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value || 0));

export default function SuccessStories() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    base44.entities.Campaign.filter({ status: "active" }, "-raised_amount", 100)
      .then((campaigns) => setItems(campaigns.filter((c) => c.goal_amount && (c.raised_amount || 0) >= c.goal_amount).slice(0, 3)))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <section className="mb-8" aria-labelledby="success-stories-title">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h2 id="success-stories-title" className="font-display text-xl text-stone-900">Success stories</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {items.map((campaign) => (
          <Link key={campaign.id} to={`/campaign/${campaign.id}`} className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[11px] uppercase tracking-wide text-amber-600 font-medium">Goal reached</span>
            <h3 className="font-display text-lg text-stone-900 mt-2 line-clamp-2">{campaign.title}</h3>
            <p className="text-xl font-semibold text-primary mt-3">{money(campaign.raised_amount, campaign.currency || "USD")}</p>
            <p className="text-xs text-stone-500">raised of {money(campaign.goal_amount, campaign.currency || "USD")}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
