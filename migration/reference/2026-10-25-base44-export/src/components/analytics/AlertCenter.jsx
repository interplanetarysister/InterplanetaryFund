import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, TrendingDown, Users2, ShieldCheck } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";

const priorityStyles = {
  critical: "bg-red-100 text-red-700 hover:bg-red-100",
  high: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  medium: "bg-stone-100 text-stone-600 hover:bg-stone-100",
};

function buildAlerts({ campaigns, opportunities, communities, volunteerOpps, applications }) {
  const alerts = [];

  opportunities.forEach((o) => {
    if (o.status !== "open" || !o.deadline) return;
    const days = differenceInCalendarDays(new Date(o.deadline), new Date());
    if (days >= 0 && days <= 30) {
      alerts.push({
        id: `deadline-${o.id}`,
        icon: Clock,
        priority: days <= 7 ? "critical" : "high",
        category: "Grant deadline",
        title: `"${o.title}" closes in ${days} day${days === 1 ? "" : "s"}`,
        action: "Submit your application before the deadline.",
        link: `/institutions/${o.institution_id}`,
      });
    }
  });

  campaigns.forEach((c) => {
    const pct = c.goal_amount ? ((c.raised_amount || 0) / c.goal_amount) * 100 : 0;
    if (c.status === "active" && pct < 20) {
      alerts.push({
        id: `risk-${c.id}`,
        icon: TrendingDown,
        priority: "high",
        category: "Campaign risk",
        title: `${c.title} is at ${Math.round(pct)}% of goal`,
        action: "Post an update and reach out to prior donors.",
        link: `/campaign/${c.id}`,
      });
    }
    if (c.status === "active" && !c.cover_image_url) {
      alerts.push({
        id: `media-${c.id}`,
        icon: AlertTriangle,
        priority: "medium",
        category: "Campaign quality",
        title: `${c.title} has no cover image`,
        action: "Campaigns with imagery raise significantly more.",
        link: `/campaign/${c.id}`,
      });
    }
  });

  volunteerOpps.forEach((o) => {
    if (o.status === "open" && !(o.volunteer_count > 0)) {
      alerts.push({
        id: `vol-${o.id}`,
        icon: Users2,
        priority: "medium",
        category: "Volunteer shortage",
        title: `No volunteers yet for "${o.role_title}"`,
        action: "Share the role with your community members.",
        link: `/community/${o.community_id}`,
      });
    }
  });

  communities.forEach((c) => {
    if ((c.member_count || 0) <= 1) {
      alerts.push({
        id: `comm-${c.id}`,
        icon: Users2,
        priority: "medium",
        category: "Community health",
        title: `${c.name} has no members yet`,
        action: "Invite members and start a first discussion.",
        link: `/community/${c.id}`,
      });
    }
  });

  applications.forEach((a) => {
    if (a.status === "submitted") {
      alerts.push({
        id: `app-${a.id}`,
        icon: ShieldCheck,
        priority: "medium",
        category: "Approval pending",
        title: `Application for "${a.opportunity_title}" awaiting review`,
        action: "Follow up with the institution if it has been a while.",
        link: "/institutions",
      });
    }
  });

  const order = { critical: 0, high: 1, medium: 2 };
  return alerts.sort((a, b) => order[a.priority] - order[b.priority]);
}

export default function AlertCenter(props) {
  const alerts = buildAlerts(props);

  return (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-12">No active alerts — everything looks healthy.</p>
      ) : (
        alerts.map((a) => (
          <Link key={a.id} to={a.link} className="block bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <a.icon className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-stone-900">{a.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{a.category}</p>
                  <p className="text-xs text-primary mt-1.5">{a.action}</p>
                </div>
              </div>
              <Badge className={`shrink-0 capitalize ${priorityStyles[a.priority]}`}>{a.priority}</Badge>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}