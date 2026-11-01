import React from "react";

export default function StatCard({ label, value, icon: Icon, hint }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</p>
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
        </span>
      </div>
      <p className="font-display text-3xl text-stone-900">{value}</p>
      {hint && <p className="text-xs text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}