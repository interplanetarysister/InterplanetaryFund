import React from "react";
import { DollarSign, Users, Megaphone, Users2, HandHeart, Building2 } from "lucide-react";

function Metric({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="font-display text-2xl text-stone-900 mt-1.5">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function MetricsGrid({ data }) {
  const { donations, campaigns, communities, signups, institutions, applications } = data;
  const totalRaised = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const recurring = donations.filter((d) => d.is_recurring && d.recurring_status === "active").length;
  const active = campaigns.filter((c) => c.status === "active").length;
  const awarded = applications.filter((a) => a.status === "awarded").length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <Metric icon={DollarSign} label="Total raised" value={`$${totalRaised.toLocaleString()}`} sub={`${recurring} active recurring gifts`} />
      <Metric icon={Users} label="Donations" value={donations.length} sub={`avg $${donations.length ? Math.round(totalRaised / donations.length) : 0}`} />
      <Metric icon={Megaphone} label="Campaigns" value={campaigns.length} sub={`${active} active`} />
      <Metric icon={Users2} label="Communities" value={communities.length} sub={`${communities.reduce((s, c) => s + (c.member_count || 0), 0)} members`} />
      <Metric icon={HandHeart} label="Volunteer signups" value={signups.length} />
      <Metric icon={Building2} label="Institutions" value={institutions.length} sub={`${awarded} grants awarded`} />
    </div>
  );
}