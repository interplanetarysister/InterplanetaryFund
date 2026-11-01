import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BookOpen, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageError from "@/components/PageError";
import PullToRefresh from "@/components/mobile/PullToRefresh";

const money = (value, currency = "USD") => {
  const amount = Number(value || 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
};

function amountFor(row) {
  if (row.entry_type === "custody") return money(row.amount, row.currency || "USD");
  if (row.net_amount) return money(row.net_amount);
  if (row.gross_amount) return money(row.gross_amount);
  return money(0);
}

export default function FinancialLedger() {
  const [entries, setEntries] = useState(null);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const { data } = await base44.functions.invoke("getOwnerFinancialLedger", {});
      if (!data || !Array.isArray(data.entries) || !data.summary) throw new Error("Malformed ledger response");
      setEntries(data.entries);
      setSummary(data.summary);
      setError("");
      return true;
    } catch (e) {
      console.error("Financial ledger load failed:", e?.name || "UnknownError");
      setEntries([]);
      setSummary(null);
      setError("We couldn't load your financial history. Please try again.");
      return false;
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries || [];
    return (entries || []).filter((row) =>
      [row.campaign_title, row.kind, row.state, row.provider, row.source_type]
        .some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [entries, query]);

  if (entries === null) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading financial ledger</span></div>;
  }

  if (error && !entries.length) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setEntries(null); load(); }} /></div>;
  }

  return (
    <PullToRefresh onRefresh={load} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900"><BookOpen className="w-7 h-7 text-primary" /> Financial ledger</h1>
          <p className="text-sm text-stone-500 mt-1">Your campaign financial operations and verified IFund custody movements in one place.</p>
        </div>
        <Button variant="outline" onClick={load} className="rounded-xl"><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">Operations</p><p className="text-xl font-semibold text-stone-900">{summary.financial_operations}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">Custody entries</p><p className="text-xl font-semibold text-stone-900">{summary.custody_entries}</p></div>
          <div className="rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">Settled IFund-held balance</p><p className="text-xl font-semibold text-emerald-700">{money(summary.settled_held_available)}</p></div>
        </div>
      )}

      <div className="relative max-w-md mb-5">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaign, provider, or state…" className="pl-9" />
      </div>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error}</div>}

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="font-display text-lg text-stone-700">{query ? "No ledger entries match that search." : "No financial ledger entries yet."}</p>
          <p className="text-sm text-stone-500 mt-1">Only canonical financial operations and verified custody movements appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <article key={row.ledger_ref} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 break-words">{row.campaign_title || "Campaign"}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{row.entry_type === "custody" ? "Custody" : "Operation"} · {row.kind} · {row.state}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-stone-900">{amountFor(row)}</p>
                  {row.provider && <p className="text-[11px] text-stone-400">{row.provider}</p>}
                </div>
              </div>
              {row.entry_type === "operation" && (
                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-stone-500">
                  <div><dt>Gross</dt><dd className="font-medium text-stone-700">{money(row.gross_amount)}</dd></div>
                  <div><dt>Processing</dt><dd className="font-medium text-stone-700">{money(row.processing_fee)}</dd></div>
                  <div><dt>Platform fee</dt><dd className="font-medium text-stone-700">{money(row.platform_fee)}</dd></div>
                  <div><dt>Net</dt><dd className="font-medium text-stone-700">{money(row.net_amount)}</dd></div>
                </dl>
              )}
              {row.occurred_at && <time className="mt-3 block text-[11px] text-stone-400">{new Date(row.occurred_at).toLocaleString()}</time>}
            </article>
          ))}
        </div>
      )}
    </PullToRefresh>
  );
}
