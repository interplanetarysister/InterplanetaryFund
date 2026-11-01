import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Loader2, RefreshCw, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageError from "@/components/PageError";
import PullToRefresh from "@/components/mobile/PullToRefresh";

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Donors() {
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { data } = await base44.functions.invoke("getOwnerDonorDirectory", {});
      if (!data || !Array.isArray(data.donors) || !data.summary) throw new Error("Malformed donor-directory response");
      setRows(data.donors);
      setSummary(data.summary);
      setError("");
      return true;
    } catch (e) {
      console.error("Donor directory load failed:", e?.name || "UnknownError");
      setRows([]);
      setSummary(null);
      setError("We couldn't load your supporter directory. Please try again.");
      return false;
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((row) =>
      row.display_name?.toLowerCase().includes(q) ||
      (row.campaigns || []).some((campaign) => campaign.title?.toLowerCase().includes(q))
    );
  }, [rows, query]);

  if (rows === null) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading supporters</span></div>;
  }

  if (error && !rows.length) {
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setRows(null); load(); }} /></div>;
  }

  return (
    <PullToRefresh onRefresh={load} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900"><Users className="w-7 h-7 text-primary" /> Supporters</h1>
          <p className="text-sm text-stone-500 mt-1">Verified support received by campaigns you own. Anonymous gifts stay anonymous.</p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl"><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">Verified gifts</p><p className="text-xl font-semibold text-stone-900">{summary.verified_gifts}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">Verified total</p><p className="text-xl font-semibold text-emerald-700">{money(summary.verified_total)}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">Known supporters</p><p className="text-xl font-semibold text-stone-900">{summary.identified_supporters}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">Anonymous gifts</p><p className="text-xl font-semibold text-stone-900">{summary.anonymous_gifts}</p></div>
        </div>
      )}

      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search supporters or campaigns…" className="mb-5 max-w-md" />

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error}</div>}

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="font-display text-lg text-stone-700">{query ? "No supporters match that search." : "No verified supporter gifts yet."}</p>
          <p className="text-sm text-stone-500 mt-1">Pending or unverified payment reports are not included.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <article key={row.donor_ref} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 break-words">{row.display_name}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{row.gift_count} verified gift{row.gift_count === 1 ? "" : "s"}{row.recurring ? " · recurring support active" : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-emerald-700">{money(row.total_given)}</p>
                  {row.recurring && <p className="text-[11px] text-violet-600 inline-flex items-center gap-1 justify-end"><Repeat2 className="w-3 h-3" /> recurring</p>}
                </div>
              </div>
              {!!row.campaigns?.length && <div className="mt-3 flex flex-wrap gap-2">{row.campaigns.map((campaign) => <span key={campaign.id} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">{campaign.title} · {money(campaign.total_given)}</span>)}</div>}
              {!row.contactable && <p className="mt-3 text-xs text-stone-400">This supporter did not provide an IFund account identity, so no contact action is exposed.</p>}
            </article>
          ))}
        </div>
      )}
    </PullToRefresh>
  );
}
