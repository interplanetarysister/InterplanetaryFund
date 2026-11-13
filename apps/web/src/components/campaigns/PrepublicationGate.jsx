import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { reviewCampaignPublication, proposePunctuationRepair, proposeRedundancyRepair } from "@/lib/prepublicationReview.mjs";

/** Free, local prepublication editor with an optional owner-authorized team queue. */
export default function PrepublicationGate({ form, campaignId, onApply, disabled = false, canSend = true }) {
  const audit = useMemo(() => reviewCampaignPublication(form), [form]);
  const punctuation = useMemo(() => proposePunctuationRepair(form?.story), [form?.story]);
  const duplication = useMemo(() => proposeRedundancyRepair(form?.story), [form?.story]);
  const [preview, setPreview] = useState(false);
  const [previewDuplication, setPreviewDuplication] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function focusImprovementField(findingId) {
    const target = findingId === "title_repetition" ? "campaign-title"
      : findingId === "summary_repeated" ? "campaign-summary" : "campaign-story";
    const field = document.getElementById(target);
    if (!field) { setError("The requested editor field is unavailable."); return; }
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    field.focus({ preventScroll: true });
    setError("");
  }

  async function sendToAgents() {
    setError(""); setMessage("");
    if (!canSend || !campaignId) {
      setError("Save this campaign as a private draft first, then submit its improvement proposals.");
      return;
    }
    if (sending || disabled || audit.findings.length === 0) return;
    setSending(true);
    try {
      const { data, error: issue } = await authClient().rpc("ifund_queue_editorial_agent_review", {
        p_campaign_id: campaignId,
        p_finding_ids: audit.findings.map(item => item.id),
      });
      if (issue || !Array.isArray(data) || data.length !== audit.findings.length)
        throw new Error(issue?.message || "Editorial work could not be confirmed in the agent queue.");
      setMessage(`${data.length} editorial work items recorded in the private agent review queue.`);
    } catch (e) { setError(e.message || "Unable to queue editorial feedback."); }
    finally { setSending(false); }
  }

  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Prepublication quality gate">
    <div>
      <h2 className="text-xl font-semibold">Prepublication quality review</h2>
      <p className="mt-1 text-sm text-muted-foreground">Story length is mandatory for new publication. Editorial suggestions are reviewable and never automatically change campaign claims.</p>
    </div>
    <div className="rounded-xl bg-muted/30 p-4" role="status" aria-live="polite">
      <p className="font-semibold">Full story: {audit.storyCharacters.toLocaleString()} / {audit.minimumCharacters.toLocaleString()} characters</p>
      <p className="mt-1 text-sm">{audit.reviewReady
        ? "Full-length minimum met. Continue to review punctuation, duplication and accuracy."
        : `Add ${audit.remainingCharacters.toLocaleString()} characters before publishing.`}</p>
    </div>
    {audit.blockers.length > 0 && <ul className="list-disc space-y-1 pl-6 text-sm text-amber-700">{audit.blockers.map(v=><li key={v}>{v}</li>)}</ul>}
    <div className="space-y-2">
      <h3 className="font-semibold">Editorial improvements ({audit.findings.length})</h3>
      {audit.findings.length===0
        ? <p className="text-sm text-muted-foreground">No heuristic punctuation or redundancy issues detected. Verify all claims yourself.</p>
        : <ul className="space-y-2">{audit.findings.map(item=><li key={item.id} className="rounded-xl border border-border p-3 text-sm">
          <strong>{item.title}</strong> <span className="text-xs text-muted-foreground">· {item.agent.toUpperCase()}</span>
          <p className="mt-1 text-muted-foreground">{item.advice}</p>
          <button type="button" disabled={disabled} onClick={() => focusImprovementField(item.id)} className="mt-2 inline-flex min-h-11 items-center text-primary underline disabled:opacity-50">Go to suggested field</button>
        </li>)}</ul>}
    </div>
    {punctuation.changed && <div className="space-y-2">
      <button type="button" disabled={disabled} onClick={()=>setPreview(v=>!v)}
        className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">
        {preview ? "Hide" : "Preview"} punctuation and spacing proposal
      </button>
      {preview && <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Review the proposed full story before accepting. Redundant factual passages are never deleted automatically.</p>
        <textarea aria-label="Proposed corrected story" readOnly value={punctuation.proposal}
          className="min-h-44 w-full rounded-xl border border-border bg-background p-3 text-sm" />
        <button type="button" disabled={disabled || !onApply} onClick={() => { onApply?.(punctuation.proposal); setPreview(false); setMessage("Punctuation proposal applied locally. Save your draft to preserve it."); }}
          className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
          Apply reviewed punctuation changes
        </button>
      </div>}
    </div>}
    {duplication.changed && <div className="space-y-2" aria-label="Repetition removal proposal">
      <button type="button" disabled={disabled} onClick={()=>setPreviewDuplication(v=>!v)}
        className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">
        {previewDuplication ? "Hide" : "Preview"} {duplication.removed} exact repeated sentence{duplication.removed===1?"":"s"}
      </button>
      {previewDuplication && <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Only exact duplicated long sentences are proposed for removal. Review carefully before accepting; first occurrences remain.</p>
        <textarea aria-label="Proposed de-duplicated story" readOnly value={duplication.proposal}
          className="min-h-44 w-full rounded-xl border border-border bg-background p-3 text-sm" />
        <button type="button" disabled={disabled || !onApply} onClick={() => { onApply?.(duplication.proposal); setPreviewDuplication(false); setMessage("Repetition proposal applied locally. Save your draft to preserve it."); }}
          className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50">
          Apply reviewed duplicate removal
        </button>
      </div>}
    </div>}
    <div className="space-y-2">
      <button type="button" disabled={disabled || sending || !canSend || audit.findings.length===0}
        onClick={sendToAgents} className="min-h-11 rounded-xl border border-cyan-500 px-4 font-semibold disabled:opacity-50">
        {sending ? "Recording review…" : "Send improvement proposals to agent team"}
      </button>
      {!campaignId && <p className="text-xs text-muted-foreground">Save a private draft first to create an owner-scoped agent review thread.</p>}
      <p className="text-xs text-muted-foreground">
        The review queue records issue categories and rule-based specialist perspectives, not raw story text.
        These are proposed discussions, not evidence of autonomous agent execution.
        <Link className="ml-1 underline" to="/agents">Review agent discussion</Link>.
      </p>
      {message && <p role="status" className="text-sm text-cyan-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  </section>;
}
