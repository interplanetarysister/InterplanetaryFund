import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCcw, Play, ClipboardCheck, Send, CheckCircle } from "lucide-react";

/** Separate super-admin release controls. All calls independently reauthorize on the backend. */
export default function BuilderExecutionControls({ incident, readiness, onRefresh }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState("");
  const [tests, setTests] = useState("");
  const [liveEvidence, setLiveEvidence] = useState("");
  const [confirmedRelease, setConfirmedRelease] = useState(false);
  if (!incident?.builder_task_id) return null;
  const state = incident.builder_execution_state || "queued";
  const run = async (mode, extra = {}) => {
    setError(""); setNotice(""); setBusy(mode);
    try {
      const response = await base44.functions.invoke("manageApprovedBuilderExecution", {
        mode, incident_id: incident.id, ...extra
      });
      const data = response?.data || {};
      if (data.ok !== true) throw new Error(data.error || "Backend did not confirm the action.");
      if (mode === "start") setNotice(data.started
        ? "The real Base44 builder accepted the assignment; review its code changes and tests."
        : data.reason || "The builder has not started.");
      if (mode === "check") setNotice("Builder platform status: " + (data.job?.provider_phase || "unavailable") +
        ". Status alone does not prove a fix.");
      if (mode === "record_review") setNotice("Review evidence recorded. Release has not been requested.");
      if (mode === "release") setNotice(data.released
        ? "Release request accepted. Verify real public behavior before closing the incident."
        : data.reason || "Release is not enabled.");
      if (mode === "verify_live") setNotice("Incident closed with the live verification evidence you supplied.");
      await onRefresh?.();
    } catch {
      setError("This builder action could not be confirmed. Check the builder record before attempting it again.");
    } finally {
      setBusy("");
    }
  };
  return <div className="space-y-3 rounded-xl border border-border bg-card p-3" aria-label="Approved builder execution">
    <div className="text-sm font-semibold text-foreground">Approved builder execution: {state.replaceAll("_", " ")}</div>
    {incident.dispatch_error && <p className="text-sm text-muted-foreground">Current blocker: {incident.dispatch_error}</p>}
    {!readiness?.configured && <p className="text-sm text-muted-foreground">The backend-only Base44 platform credential and workspace authorization are not configured.</p>}
    {readiness?.configured && !readiness?.credits_enabled && <p className="text-sm text-muted-foreground">The zero-credit safeguard is active. Builder execution requires an explicitly enabled credit allowance.</p>}
    {incident.builder_provider_phase && <p className="text-sm text-muted-foreground">Provider-reported phase: {incident.builder_provider_phase} (not test or deployment proof)</p>}
    {["queued", "blocked_config", "blocked_credits", "failed"].includes(state) &&
      <button type="button" onClick={() => run("start")} disabled={!!busy || !readiness?.can_start}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50">
        <Play className="h-4 w-4"/>Start approved builder work
      </button>}
    {["submitted", "review_required", "released_unverified"].includes(state) &&
      <button type="button" onClick={() => run("check")} disabled={!!busy || !readiness?.can_start}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50">
        <RefreshCcw className="h-4 w-4"/>Check builder status
      </button>}
    {state === "failed_uncertain" && <p role="alert" className="text-sm text-destructive">Builder submission outcome is unknown. Inspect the original Base44 builder activity before another request; do not repeat automatically.</p>}
    {state === "submitted" && <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Inspect the actual Base44 source diff and run regression tests before authorizing a release. This form records your review; it does not independently execute tests.</p>
      <label className="block text-sm text-foreground">Actual code revision or commit ID
        <input value={revision} onChange={e=>setRevision(e.target.value)} placeholder="Revision hash" className="block mt-1 w-full min-h-11 rounded-lg border border-border bg-background px-3"/>
      </label>
      <label className="block text-sm text-foreground">Completed regression test evidence
        <textarea value={tests} onChange={e=>setTests(e.target.value)} rows={3} placeholder="Which checks ran and what were the results?" className="block mt-1 w-full rounded-lg border border-border bg-background p-3 resize-y"/>
      </label>
      <button type="button" disabled={!!busy || !/^[a-f0-9]{7,64}$/i.test(revision) || tests.trim().length < 25}
        onClick={()=>run("record_review",{revision:revision.trim(),tests:tests.trim()})}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50">
        <ClipboardCheck className="h-4 w-4"/>Record reviewed code and tests
      </button>
    </div>}
    {state === "review_required" && <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Reviewed revision and tests: {incident.builder_review_evidence || "Saved in the incident record"}.</p>
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={confirmedRelease} onChange={e=>setConfirmedRelease(e.target.checked)} className="mt-1"/>
        I reviewed the full current IFund app state, including any other pending changes, and approve publishing it after checking the source, tests, and rollback plan.
      </label>
      <button type="button" disabled={!!busy || !confirmedRelease || !readiness?.can_start || !readiness?.release_enabled}
        onClick={()=>run("release",{confirm_release:true,confirm_entire_current_app:true})}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50">
        <Send className="h-4 w-4"/>Approve Base44 release
      </button>
      {!readiness?.release_enabled && <p className="text-xs text-muted-foreground">Deployment is disabled at the backend until explicitly configured.</p>}
    </div>}
    {state === "released_unverified" && <div className="space-y-2">
      <p className="text-sm text-muted-foreground">A release request was sent. Confirm behavior on the actual published domain and mobile app before closing.</p>
      <label className="block text-sm text-foreground">Dated live verification evidence
        <textarea value={liveEvidence} onChange={e=>setLiveEvidence(e.target.value)} rows={3} placeholder="Live URL tested, user roles and results, date, rollback readiness" className="block mt-1 w-full rounded-lg border border-border bg-background p-3 resize-y"/>
      </label>
      <button type="button" disabled={!!busy || liveEvidence.trim().length < 35} onClick={()=>run("verify_live",{live_evidence:liveEvidence.trim()})}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-foreground disabled:opacity-50">
        <CheckCircle className="h-4 w-4"/>Record verified live fix
      </button>
    </div>}
    {notice && <p role="status" className="text-sm text-foreground">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
