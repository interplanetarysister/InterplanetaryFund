import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, ShieldCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import PageError from "@/components/PageError";

const FINANCIAL_ACTION = /(donation|withdrawal|paypal|stripe|fund|payout|settlement|collect)/i;

export default function AuditLogAdmin() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [financialOnly, setFinancialOnly] = useState(true);

  const load = async () => {
    try {
      const data = await base44.entities.AuditLog.list("-created_date", 500);
      if (!Array.isArray(data)) throw new Error("Malformed audit response");
      setRows(data);
      setError("");
      return true;
    } catch (e) {
      console.error("Audit log load failed:", e?.name || "UnknownError");
      setRows([]);
      setError("We couldn't load the audit log. Please try again.");
      return false;
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter((row) => {
      if (financialOnly && !FINANCIAL_ACTION.test(String(row.action || ""))) return false;
      if (!q) return true;
      return [row.action, row.target_type, row.detail, row.status].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [rows, query, financialOnly]);

  if (rows === null) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading audit log</span></div>;
  }
  if (error && !rows.length) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setRows(null); load(); }} /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900"><ShieldCheck className="w-7 h-7 text-primary" /> Audit log</h1>
          <p className="text-sm text-stone-500 mt-1">Admin-only operational history. Secret metadata is redacted before it is written.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={financialOnly} onChange={(e) => setFinancialOnly(e.target.checked)} />
          Financial activity only
        </label>
      </div>

      <div className="relative max-w-md mb-5">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions, targets, or details…" className="pl-9" />
      </div>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error}</div>}

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">No matching audit events.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <article key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 break-words">{row.action || "unknown"}</p>
                  <p className="text-xs text-stone-500 mt-0.5">{row.target_type || "event"}{row.status ? ` · ${row.status}` : ""}</p>
                </div>
                <time className="text-xs text-stone-400 shrink-0">{row.created_date ? new Date(row.created_date).toLocaleString() : ""}</time>
              </div>
              {row.detail && <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap break-words">{row.detail}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
