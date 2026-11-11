import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCopy, Download, ExternalLink, FileCheck2, Filter, LockKeyhole, RefreshCw, Save } from "lucide-react";
import { authClient } from "@/api/auth";
import { FLOWS, STATUS, STEPS, recordFor, readiness, makeReport, parseLinks, validateRecord } from "@/lib/hackathonTracker.mjs";

const palette = {
  unknown: "border-slate-500/40 bg-slate-500/10 text-slate-200",
  pending: "border-sky-400/40 bg-sky-500/10 text-sky-200",
  blocked: "border-amber-400/50 bg-amber-500/10 text-amber-200",
  completed: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
};
const fieldClass = "mt-2 w-full min-h-11 rounded-xl border border-slate-600/70 bg-slate-950/80 px-3 py-3 text-base text-slate-100 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20";
const fieldStyle = { color: "#f8fafc", WebkitTextFillColor: "#f8fafc", backgroundColor: "#020617" };
const dateLabel = (value) => value ? new Date(value).toLocaleString() : "Not recorded";
function StatusTag({ value }) {
  return <span className={"inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize " + palette[value || "unknown"]}>{value || "unknown"}</span>;
}
function InputField({ label, value, onChange, placeholder, multiline = false, rows = 3, hint }) {
  return <label className="block text-sm font-medium text-slate-200">
    <span>{label}</span>
    {multiline
      ? <textarea rows={rows} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={fieldClass + " resize-y"} style={fieldStyle} />
      : <input type="text" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={fieldClass} style={fieldStyle} />}
    {hint && <span className="mt-1 block text-xs font-normal text-slate-400">{hint}</span>}
  </label>;
}

export default function HackathonTracker() {
  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [flow, setFlow] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(STEPS[0].key);
  const [draft, setDraft] = useState(recordFor(STEPS[0]));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editError, setEditError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const totals = useMemo(() => readiness(records), [records]);
  const report = useMemo(() => makeReport(records), [records]);
  const currentStep = STEPS.find(step => step.key === selected) || STEPS[0];
  const filtered = totals.rows.filter(row =>
    (flow === "all" || row.flow === flow) &&
    (statusFilter === "all" || row.record.status === statusFilter) &&
    (!search.trim() || (row.title + " " + row.check).toLowerCase().includes(search.trim().toLowerCase()))
  );
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error } = await authClient().from("ifund_hackathon_demo_steps").select("*").limit(100);
      if (error) throw error;
      const next = Object.fromEntries((data || []).map(row => [row.step_key, row]));
      setRecords(next);
      setDraft(recordFor(STEPS.find(x => x.key === selected) || STEPS[0], next[selected]));
      setDirty(false);
    } catch (e) {
      setLoadError("Tracker storage could not be verified: " + (e.message || "unknown error") + ". Changes cannot be saved.");
    } finally { setLoading(false); }
  }, [selected]);
  useEffect(() => { reload(); }, []); // Initial read only. Selecting a step should not discard unsaved work.

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const pick = (step) => {
    if (dirty && !window.confirm("Discard unsaved changes to this tracker step?")) return;
    setSelected(step.key);
    setDraft(recordFor(step, records[step.key]));
    setDirty(false);
    setNotice("");
    setEditError("");
  };
  const change = (patch) => { setDraft(row => ({ ...row, ...patch })); setDirty(true); setNotice(""); setEditError(""); };
  const save = async () => {
    if (saving || loading || loadError) return;
    setSaving(true); setEditError(""); setNotice("");
    try {
      const checked = {
        ...draft,
        evidence_links: parseLinks(draft.evidence_links.join("\n")),
        screenshot_links: parseLinks(draft.screenshot_links.join("\n")),
        commit_sha: draft.commit_sha.trim().toLowerCase(),
        preview_url: draft.preview_url.trim(),
        test_result: draft.test_result.trim(),
        blocker: draft.blocker.trim(),
        next_action: draft.next_action.trim(),
        deployment_notes: draft.deployment_notes.trim(),
      };
      const invalid = validateRecord(checked);
      if (invalid) throw Error(invalid);
      const client = authClient();
      const { data: userData, error: authError } = await client.auth.getUser();
      if (authError || !userData?.user?.id) throw Error("A verified administrator session is required.");
      const record = {
        step_key: checked.step_key, status: checked.status,
        evidence_links: checked.evidence_links, screenshot_links: checked.screenshot_links,
        test_result: checked.test_result, blocker: checked.blocker, next_action: checked.next_action,
        commit_sha: checked.commit_sha, preview_url: checked.preview_url,
        deployment_notes: checked.deployment_notes, updated_by: userData.user.id,
        checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        revision: (checked.revision || 0) + 1,
      };
      let query;
      if (checked.revision) {
        query = client.from("ifund_hackathon_demo_steps").update(record)
          .eq("step_key", checked.step_key).eq("revision", checked.revision).select().single();
      } else {
        query = client.from("ifund_hackathon_demo_steps").insert(record).select().single();
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data) throw Error("No saved record was returned. Refresh before retrying.");
      setRecords(old => ({ ...old, [checked.step_key]: data }));
      setDraft(recordFor(currentStep, data));
      setDirty(false);
      setNotice("Saved to the existing iFund Supabase project. This is manual evidence tracking, not automatic provider certification.");
    } catch (e) {
      setEditError((e?.code === "23505" || e?.code === "PGRST116")
        ? "Another update was saved first. Refresh and reconcile rather than overwriting it."
        : (e.message || "Save failed. No success recorded."));
    } finally { setSaving(false); }
  };
  const copyReport = async () => {
    try { await navigator.clipboard.writeText(report); setNotice("Readiness report copied."); }
    catch { setEditError("Clipboard permission unavailable. Select the report text and copy manually."); }
  };
  const downloadReport = () => {
    const file = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url; link.download = "ifund-paypal-hackathon-readiness.md";
    link.click(); URL.revokeObjectURL(url);
  };

  return <main className="deep-space min-h-dvh px-4 py-7 pb-24 text-slate-100 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <nav aria-label="PayPal hackathon organizer navigation" className="flex flex-wrap items-center gap-3 text-sm">
        <Link to="/hackathon" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 font-semibold text-cyan-100"><ArrowLeft size={16}/> Back to PayPal Hackathon demo</Link>
        <a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-slate-200" href="https://github.com/interplanetarysister/InterplanetaryFund/blob/main/docs/hackathon/JUDGE_TESTING.md" target="_blank" rel="noopener noreferrer">Judge guide <ExternalLink size={14}/></a>
      </nav>
      <header className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950/70 px-5 py-7 sm:px-8">
        <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-300"><LockKeyhole size={14}/> Organizer-only · PayPal AI Hackathon 2026</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Demo readiness tracker</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">A guided evidence workspace for the existing iFund /hackathon experience. Check real results, preserve unknowns, and document what judges can actually test.</p>
          <p className="mt-4 text-xs font-semibold text-amber-200">Sandbox only · Never enables live payments · Final deadline: November 12, 2026, noon Pacific</p>
        </div>
      </header>
      <section aria-label="Readiness summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Completed", totals.counts.completed, "text-emerald-300"],
          ["Pending", totals.counts.pending, "text-sky-300"],
          ["Blocked", totals.counts.blocked, "text-amber-300"],
          ["Unknown", totals.counts.unknown, "text-slate-200"],
        ].map(([label, count, color]) =>
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className={"text-3xl font-bold tabular-nums " + color}>{count}</div>
            <div className="mt-1 text-sm text-slate-300">{label}</div>
          </div>
        )}
      </section>
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
        <div className="flex items-start gap-3"><AlertTriangle size={19} className="mt-0.5 shrink-0"/>
          <p><strong>{totals.reviewed ? "All steps manually recorded complete — independent review still required." : "Submission not yet verified ready."}</strong> These are organizer-entered assessments, not live PayPal checks. The sandbox receipt tables are isolated from actual donations, withdrawal balances and public campaign totals.</p>
        </div>
      </div>
      {loadError && <div role="alert" className="rounded-xl border border-red-400/40 bg-red-950/30 p-4 text-red-100">{loadError} <button onClick={reload} className="ml-2 underline">Retry</button></div>}
      {loading && <p role="status" className="text-slate-300">Loading saved evidence from Supabase…</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section aria-label="Guided verification steps" className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Verification steps <span className="text-slate-400">({filtered.length})</span></h2>
            <button onClick={reload} disabled={loading || dirty} title={dirty ? "Save or discard changes before refreshing" : "Refresh evidence"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm disabled:opacity-50"><RefreshCw size={15}/> Refresh</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm text-slate-300">Demo flow
              <select className={fieldClass} style={fieldStyle} value={flow} onChange={e => setFlow(e.target.value)}><option value="all">All demo flows</option>{FLOWS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
            </label>
            <label className="text-sm text-slate-300">Status
              <select className={fieldClass} style={fieldStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option>{STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select>
            </label>
          </div>
          <label className="block text-sm text-slate-300">Search checks
            <input className={fieldClass} style={fieldStyle} type="search" placeholder="Search the demo workflow…" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <div className="space-y-2">
            {filtered.length === 0 && <p className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">No steps match these filters.</p>}
            {filtered.map((row, index) => <button type="button" key={row.key} onClick={() => pick(row)} aria-pressed={selected === row.key}
              className={"w-full rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " +
                (selected === row.key ? "border-cyan-400/70 bg-cyan-500/10" : "border-white/10 bg-slate-950/70 hover:border-cyan-400/30")}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold tabular-nums text-cyan-100">{STEPS.indexOf(STEPS.find(s=>s.key===row.key)) + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2"><span className="text-base font-semibold text-slate-100">{row.title}</span><StatusTag value={row.record.status}/></div>
                  <p className="mt-1 text-xs text-slate-400">{FLOWS.find(f=>f.id===row.flow)?.label}</p>
                  {row.record.next_action && <p className="mt-2 line-clamp-2 text-sm text-slate-300">Next: {row.record.next_action}</p>}
                </div>
              </div>
            </button>)}
          </div>
        </section>
        <section id="hackathon-step-detail" aria-label="Selected verification step" className="min-w-0 self-start rounded-3xl border border-white/15 bg-slate-950/80 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Evidence record</p><StatusTag value={draft.status}/></div>
          <h2 className="mt-3 text-2xl font-bold">{currentStep.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{currentStep.check}</p>
          {currentStep.action && <Link to={currentStep.action} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-200 underline">Open related iFund experience <ExternalLink size={14}/></Link>}
          <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
            <label className="block text-sm font-medium text-slate-200">Verification status
              <select className={fieldClass} style={fieldStyle} value={draft.status} onChange={e => change({ status: e.target.value })}>
                {STATUS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </label>
            <InputField label="Test result" value={draft.test_result} onChange={v=>change({test_result:v})} multiline placeholder="What was actually observed? Include timestamp, redacted request/response, and expected vs. actual behavior."/>
            <InputField label="Evidence links (one HTTPS URL per line)" value={draft.evidence_links.join("\n")} onChange={v=>change({evidence_links:v.split("\n")})} multiline rows={3} placeholder="https://…" hint="Link to provider records, logs, CI test output, or issue/commit evidence. Never paste credentials."/>
            <InputField label="Screenshot links (one HTTPS URL per line)" value={draft.screenshot_links.join("\n")} onChange={v=>change({screenshot_links:v.split("\n")})} multiline rows={2} placeholder="https://…" hint="Use an existing controlled storage location. Do not expose private identities or payment details."/>
            <InputField label="Blocker" value={draft.blocker} onChange={v=>change({blocker:v})} multiline rows={2} placeholder="What prevents this gate from passing?" />
            <InputField label="Next action" value={draft.next_action} onChange={v=>change({next_action:v})} multiline rows={2} placeholder="The concrete next test, fix, or review" />
            <div className="grid gap-3 sm:grid-cols-2">
              <InputField label="Git commit SHA" value={draft.commit_sha} onChange={v=>change({commit_sha:v})} placeholder="7–40 hex characters" />
              <InputField label="Preview URL" value={draft.preview_url} onChange={v=>change({preview_url:v})} placeholder="https://…pages.dev/hackathon" />
            </div>
            <InputField label="Deployment notes" value={draft.deployment_notes} onChange={v=>change({deployment_notes:v})} multiline placeholder="Cloudflare environment, deployed build, browser checks or rollback notes" />
            <div className="text-xs text-slate-400">Last recorded check: {dateLabel(draft.checked_at)} · Revision: {draft.revision || "not saved"}</div>
            {editError && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-200">{editError}</p>}
            {notice && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</p>}
            <button type="button" onClick={save} disabled={loading || !!loadError || saving || !dirty} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 font-bold text-slate-950 disabled:opacity-50"><Save size={18}/>{saving ? "Saving evidence…" : dirty ? "Save status and evidence" : "No unsaved changes"}</button>
          </div>
        </section>
      </div>
      <section className="space-y-4 rounded-3xl border border-white/15 bg-slate-950/75 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Submission audit</p><h2 className="mt-1 text-xl font-bold">Concise readiness report</h2></div>
          <button type="button" onClick={()=>setShowReport(x=>!x)} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm">{showReport ? "Hide report" : "Generate report"}</button>
        </div>
        <p className="text-sm text-slate-300">{totals.open.length} of {STEPS.length} gates have not been manually marked complete. Reports preserve missing evidence as unknown or incomplete.</p>
        {showReport && <>
          <textarea className={fieldClass + " w-full font-mono text-sm"} style={fieldStyle} rows={12} readOnly aria-label="Generated readiness report" value={report}/>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={copyReport} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold"><ClipboardCopy size={17}/> Copy report</button>
            <button type="button" onClick={downloadReport} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold"><Download size={17}/> Download Markdown</button>
          </div>
        </>}
        <p className="text-xs text-slate-400">This report is manually maintained; it cannot certify signed webhooks or provider settlement without external verification. Only a controlled sandbox test can do that.</p>
      </section>
    </div>
  </main>;
}
