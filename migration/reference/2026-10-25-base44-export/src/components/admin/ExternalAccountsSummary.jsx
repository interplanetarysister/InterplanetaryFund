import React from "react";
import { healthStatus, completenessLevel, isStale } from "@/lib/externalAccounts";
import { Link2, ShieldCheck, AlertTriangle, Clock, FileWarning } from "lucide-react";

const Card = ({ label, value, icon: Icon, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone}`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <Icon className="w-4 h-4 text-stone-400" />
    </div>
    <p className="font-display text-3xl text-stone-900 mt-1">{value}</p>
  </div>
);

// Color-coded summary strip at the top of External Accounts. "Verified" is the
// honest proxy for identity verification we don't store a flag for: a profile
// that is complete AND healthy.
export default function ExternalAccountsSummary({ connections }) {
  const total = connections.length;
  const verified = connections.filter((c) => completenessLevel(c) === "complete" && healthStatus(c) === "connected").length;
  const incomplete = connections.filter((c) => completenessLevel(c) === "incomplete").length;
  const requiresAction = connections.filter((c) => healthStatus(c) === "requires_action").length;
  const stale = connections.filter((c) => isStale(c)).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card label="Total Accounts" value={total} icon={Link2} tone="border-stone-200 bg-white" />
      <Card label="Verified" value={verified} icon={ShieldCheck} tone="border-emerald-200 bg-emerald-50" />
      <Card label="Profile Incomplete" value={incomplete} icon={FileWarning} tone="border-orange-200 bg-orange-50" />
      <Card label="Requires Admin Action" value={requiresAction} icon={AlertTriangle} tone="border-red-200 bg-red-50" />
      <Card label="Stale (7+ days)" value={stale} icon={Clock} tone="border-amber-200 bg-amber-50" />
    </div>
  );
}