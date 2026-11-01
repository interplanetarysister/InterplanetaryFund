import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/dashboard/StatCard";
import RecurringPlanCard from "@/components/giving/RecurringPlanCard";
import DonationRow from "@/components/giving/DonationRow";
import { DollarSign, Repeat, Flame, Loader2 } from "lucide-react";
import PageError from "@/components/PageError";

export default function MyGiving() {
  const [donations, setDonations] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      // Financial truth boundary: only provider-verified gifts count as giving.
      // getMyGiving returns verified donations server-side; manual PayPal/Cash
      // App reports remain pending until separately verified.
      const { data } = await base44.functions.invoke("getMyGiving", {});
      if (!data || !Array.isArray(data.donations) || data.donations.some((row) => !row || typeof row !== "object" || !Number.isFinite(Number(row.amount)))) {
        throw new Error("Malformed giving response");
      }
      setDonations(data.donations);
    } catch (_) {
      setError("We couldn't load your giving history. Please try again.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setDonations(null); load(); }} /></div>;
  }
  if (!donations) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const lifetime = donations.reduce((s, d) => s + d.amount, 0);
  const campaignsSupported = new Set(donations.map((d) => d.campaign_id)).size;
  const recurring = donations.filter((d) => d.is_recurring);
  const monthlyActive = recurring.filter((d) => (d.recurring_status || "active") === "active").reduce((s, d) => s + d.amount, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900 mb-2">My Giving</h1>
      <p className="text-stone-500 mb-8">Your generosity, all in one place.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Lifetime Giving" value={`$${lifetime.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Monthly Giving" value={`$${monthlyActive.toLocaleString()}`} icon={Repeat} hint="active recurring gifts" />
        <StatCard label="Campaigns Supported" value={campaignsSupported} icon={Flame} />
      </div>

      {recurring.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-xl text-stone-900 mb-3">Recurring gifts</h2>
          <div className="space-y-3">
            {recurring.map((d) => <RecurringPlanCard key={d.id} donation={d} onChanged={load} />)}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl text-stone-900 mb-3">Donation history</h2>
        <div className="bg-white rounded-2xl border border-stone-200/70 px-5 py-2 shadow-sm">
          {donations.length === 0 ? (
            <p className="text-sm text-stone-400 py-6 text-center">No confirmed donations yet — find a cause on the Discover page.</p>
          ) : (
            donations.map((d) => <DonationRow key={d.id} donation={d} />)
          )}
        </div>
      </section>
    </div>
  );
}