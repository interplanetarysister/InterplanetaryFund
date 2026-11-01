import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ExternalLink, Leaf, RefreshCw, ShieldCheck, Server, FileCheck2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Browser observations are intentionally NOT presented as electricity use, CO2,
// platform-wide totals, or verified environmental benefits.
export function sampleBrowserTransfer(performanceObject = typeof performance === "undefined" ? null : performance) {
  if (!performanceObject?.getEntriesByType) return null;
  const resources = [
    ...performanceObject.getEntriesByType("navigation"),
    ...performanceObject.getEntriesByType("resource"),
  ];
  const measurable = resources.filter((entry) => Number.isFinite(entry.transferSize) && entry.transferSize > 0);
  return {
    measuredAt: new Date().toISOString(),
    count: resources.length,
    knownCount: measurable.length,
    missingCount: resources.length - measurable.length,
    transferBytes: measurable.reduce((sum, entry) => sum + entry.transferSize, 0),
  };
}

const formatSize = (bytes) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  : `${(bytes / 1024).toFixed(1)} KB`;

const kinds = {
  hosting: "Hosting electricity / infrastructure",
  efficiency: "Software or resource efficiency",
  environmental_impact: "Verified project outcome",
};

export default function SustainabilityAdmin() {
  const [sample, setSample] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [audits, setAudits] = useState([]);
  const [campaignError, setCampaignError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState("hosting");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const refresh = useCallback(async () => {
    setBusy(true);
    const results = await Promise.allSettled([
      base44.entities.Campaign.filter({ category: "environment", status: "active" }, "-created_date", 100),
      base44.entities.SustainabilityAudit.list("-created_date", 25),
    ]);
    const [campaignResult, auditResult] = results;
    if (campaignResult.status === "fulfilled" && Array.isArray(campaignResult.value)) {
      setCampaigns(campaignResult.value);
      setCampaignError("");
    } else setCampaignError("Environmental campaign count is unavailable right now.");
    if (auditResult.status === "fulfilled" && Array.isArray(auditResult.value)) {
      setAudits(auditResult.value);
      setAuditError("");
    } else setAuditError("Saved assessments could not be loaded.");
    setSample(sampleBrowserTransfer());
    setBusy(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const recordSample = async () => {
    const next = sampleBrowserTransfer();
    setSample(next);
    if (!next) { setSaveMessage("This browser does not expose resource timings."); return; }
    setSaving(true);
    setSaveMessage("");
    try {
      await base44.entities.SustainabilityAudit.create({
        kind: "browser_sample",
        summary: "Admin browser transfer-size sample",
        observed_at: next.measuredAt,
        verification_status: "unverified",
        transfer_bytes_observed: next.transferBytes,
        resource_count_observed: next.count,
        resources_missing_transfer_data: next.missingCount,
        notes: "Partial browser-local observation. A missing transfer size may reflect browser caching or timing restrictions. Not platform totals or carbon emissions.",
      });
      setSaveMessage("Browser observation saved to the admin evidence log.");
      await refresh();
    } catch {
      setSaveMessage("Could not save the observation. Nothing was recorded.");
    } finally {
      setSaving(false);
    }
  };

  const recordEvidence = async (event) => {
    event.preventDefault();
    setSaveMessage("");
    const name = summary.trim();
    const evidence = sourceUrl.trim();
    if (!name || name.length > 220) { setSaveMessage("Enter a brief evidence description (up to 220 characters)."); return; }
    if (evidence) {
      try {
        if (new URL(evidence).protocol !== "https:") throw new Error("Not HTTPS");
      } catch {
        setSaveMessage("Evidence link must be a complete https:// URL.");
        return;
      }
    }
    setSaving(true);
    try {
      await base44.entities.SustainabilityAudit.create({
        kind,
        summary: name,
        observed_at: new Date().toISOString(),
        source_url: evidence,
        notes: notes.trim().slice(0, 2000),
        // Recording a link is not independent verification.
        verification_status: evidence ? "documented" : "unverified",
      });
      setSummary(""); setNotes(""); setSourceUrl("");
      setSaveMessage("Evidence noted. It has not been independently verified.");
      await refresh();
    } catch {
      setSaveMessage("The evidence note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const hostingAudit = audits.find((audit) => audit.kind === "hosting" && audit.verification_status === "independently_verified");
  const latestSamples = audits.filter((audit) => audit.kind === "browser_sample").slice(0, 5);
  const sampleCount = sample?.knownCount || 0;

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Leaf size={18} /> IFund Sustainability</p>
            <h1 className="font-display mt-2 text-3xl text-white">Planet Impact</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Measure what we can, document what we cannot, and avoid unsupported carbon-neutral or renewable-energy claims.
            </p>
          </div>
          <button type="button" onClick={refresh} disabled={busy || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 px-4 text-sm text-slate-100 disabled:opacity-60">
            <RefreshCw size={16} /> {busy ? "Refreshing…" : "Refresh"}
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <Server className="text-cyan-300" size={22} />
            <h2 className="mt-3 text-sm font-semibold text-slate-200">Hosting energy</h2>
            <p className="mt-2 text-xl font-bold text-white">{hostingAudit ? "Evidence logged" : "Not verified"}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {hostingAudit ? "Review the source and date before using this in public claims." : "No independent evidence of renewable-powered hosting is recorded."}
            </p>
          </section>
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <Leaf className="text-emerald-300" size={22} />
            <h2 className="mt-3 text-sm font-semibold text-slate-200">Environment campaigns</h2>
            <p className="mt-2 text-xl font-bold text-white">{campaignError ? "Unavailable" : campaigns.length >= 100 ? "100+ (page limit)" : campaigns.length}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Active campaigns categorized Planet & Environment. No ecological outcomes or donation totals are inferred.
            </p>
            <Link className="mt-3 inline-flex items-center gap-1 text-sm text-cyan-300 underline" to="/discover">View campaigns</Link>
          </section>
          <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <Activity className="text-violet-300" size={22} />
            <h2 className="mt-3 text-sm font-semibold text-slate-200">This browser session</h2>
            <p className="mt-2 text-xl font-bold text-white">{sampleCount ? formatSize(sample.transferBytes) : "No measured bytes"}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Network bytes observable in this browser session only, not whole-site traffic or emissions.
            </p>
          </section>
        </div>

        {(campaignError || auditError) && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-100">{[campaignError, auditError].filter(Boolean).join(" ")}</div>}

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Activity size={20} /> Resource snapshot</h2>
          <p className="mt-2 text-sm text-slate-300">
            {sample ? `${sample.count} browser resource entries; ${sample.knownCount} measurable transfers; ${sample.missingCount} cached, opaque or otherwise unmeasured.` : "Timing API unavailable."}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">Only entries reporting a positive transfer size are included. Browser caches, cross-origin security restrictions and prior sessions limit coverage. Smaller transfers often help performance, but this is not an energy or carbon calculation.</p>
          <button type="button" disabled={saving || busy} onClick={recordSample} className="mt-4 min-h-11 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">Save browser snapshot</button>
          {latestSamples.length > 0 && <div className="mt-4 space-y-1 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Recently saved samples</p>
            {latestSamples.map((record) => <p key={record.id}>{record.observed_at?.slice(0, 16).replace("T", " ") || "Date unknown"} · {formatSize(record.transfer_bytes_observed || 0)} observed · {record.resources_missing_transfer_data || 0} unmeasured</p>)}
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FileCheck2 size={20} /> Evidence log</h2>
          <p className="mt-2 text-sm text-slate-300">Record hosting provider evidence, efficiency work and independently documented project outcomes. A saved source is not automatically a verified claim.</p>
          <form className="mt-4 space-y-3" onSubmit={recordEvidence}>
            <label className="block text-sm text-slate-200">Evidence type
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full min-h-11 rounded-lg border border-slate-500 bg-slate-950 p-2 text-white">
                {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm text-slate-200">What was checked?
              <input value={summary} maxLength={220} required onChange={(e) => setSummary(e.target.value)} className="mt-1 w-full min-h-11 rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" placeholder="e.g. Hosting provider electricity disclosure" />
            </label>
            <label className="block text-sm text-slate-200">Evidence URL (optional)
              <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="mt-1 w-full min-h-11 rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" placeholder="https://…" />
            </label>
            <label className="block text-sm text-slate-200">Notes (optional)
              <textarea value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-500 bg-slate-950 p-2 text-white" placeholder="Describe what is known and what still needs to be confirmed. Do not include private information." />
            </label>
            <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">Save evidence note</button>
          </form>
          {saveMessage && <p role="status" className="mt-3 text-sm text-cyan-200">{saveMessage}</p>}
          <div className="mt-5 space-y-3">
            {audits.filter((entry) => entry.kind !== "browser_sample").length === 0 && <p className="text-sm text-slate-400">No evidence notes recorded yet.</p>}
            {audits.filter((entry) => entry.kind !== "browser_sample").map((entry) => (
              <article key={entry.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-sm font-semibold text-white break-words">{entry.summary}</p>
                <p className="mt-1 text-xs text-slate-400">{kinds[entry.kind] || "Audit"} · {entry.observed_at?.slice(0, 10) || "Unknown date"} · {entry.verification_status === "independently_verified" ? "Previously marked independently verified" : entry.verification_status === "documented" ? "Source recorded, verification pending" : "Unverified"}</p>
                {entry.notes && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-300">{entry.notes}</p>}
                {entry.source_url?.startsWith("https://") && <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 break-all text-xs text-cyan-300 underline">View provided evidence <ExternalLink size={12} /></a>}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-100"><ShieldCheck size={19} /> Next verification steps</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-200">
            <li>Check actual hosting electricity claims, including the provider and data center regions in use.</li>
            <li>Reduce page payloads and unnecessary AI polls, then compare browser samples from the same testing conditions.</li>
            <li>Ask environmental campaign creators for dated evidence of outcomes before sharing public impact numbers.</li>
            <li>Never describe IFund as carbon-neutral without an independently supportable emissions inventory.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <a className="text-cyan-300 underline" href="https://www.thegreenwebfoundation.org/" target="_blank" rel="noopener noreferrer">Green Web Foundation <ExternalLink size={12} className="inline" /></a>
            <a className="text-cyan-300 underline" href="https://www.w3.org/TR/web-sustainability-guidelines/" target="_blank" rel="noopener noreferrer">W3C web sustainability guidance <ExternalLink size={12} className="inline" /></a>
          </div>
        </section>
      </div>
    </div>
  );
}
