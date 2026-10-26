import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

export default function RevenueChart({ donations }) {
  const days = Array.from({ length: 30 }, (_, i) => startOfDay(subDays(new Date(), 29 - i)));
  const data = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const total = donations
      .filter((d) => format(new Date(d.created_date), "yyyy-MM-dd") === key)
      .reduce((s, d) => s + (d.amount || 0), 0);
    return { label: format(day, "MMM d"), amount: total };
  });

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
      <h3 className="font-semibold text-sm text-stone-900">Revenue — last 30 days</h3>
      <p className="text-xs text-stone-400 mb-4">Historical giving across all campaigns.</p>
      <div className="h-56" role="img" aria-label="Daily donation revenue over the last 30 days">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#a8a29e" }} interval={6} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
            <Area type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={2} fill="url(#rev)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}