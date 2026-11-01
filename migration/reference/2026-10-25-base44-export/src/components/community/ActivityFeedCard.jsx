import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Sparkles, Megaphone, Heart, Rocket, FileText, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_META = {
  campaign_created: { icon: Rocket, label: "New campaign", tint: "bg-cyan-500/15 text-cyan-600" },
  campaign_update: { icon: FileText, label: "Update", tint: "bg-blue-500/15 text-blue-600" },
  donation_received: { icon: Heart, label: "Donation", tint: "bg-rose-500/15 text-rose-600" },
  milestone: { icon: TrendingUp, label: "Milestone", tint: "bg-amber-500/15 text-amber-600" },
  announcement: { icon: Megaphone, label: "Announcement", tint: "bg-violet-500/15 text-violet-600" },
  feature: { icon: Sparkles, label: "New feature", tint: "bg-emerald-500/15 text-emerald-600" },
};

export default function ActivityFeedCard({ event }) {
  const meta = TYPE_META[event.type] || { icon: Sparkles, label: "Activity", tint: "bg-slate-500/15 text-slate-600" };
  const Icon = meta.icon;
  const link = event.link || (event.campaign_id ? `/campaign/${event.campaign_id}` : null);

  const inner = (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.tint}`}>{meta.label}</span>
        <span className="text-[11px] text-stone-400">{formatDistanceToNow(new Date(event.created_date), { addSuffix: true })}</span>
      </div>
      {event.campaign_image_url && (
        <div className="mb-2 h-24 rounded-xl overflow-hidden">
          <Image src={event.campaign_image_url} alt={event.campaign_title || ""} className="w-full h-full object-cover" />
        </div>
      )}
      <p className="text-sm text-stone-700 leading-relaxed">{event.body}</p>
      {event.campaign_title && <p className="text-xs text-stone-400 mt-1">{event.campaign_title}</p>}
    </>
  );

  if (link) {
    return (
      <Link to={link} className="block bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 hover:shadow-md hover:border-stone-300 transition-all">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${meta.tint}`}><Icon className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">{inner}</div>
        </div>
      </Link>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${meta.tint}`}><Icon className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">{inner}</div>
      </div>
    </div>
  );
}