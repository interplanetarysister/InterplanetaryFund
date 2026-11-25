import { useState } from "react";
import CampaignEngagement from "../../pages/CampaignEngagement";
import { evaluatePostDraft, summarizeAudienceFeedback } from "../../lib/audiencePostReview.mjs";

export default function AudienceReviewBench() {
  const [draft, setDraft] = useState("");
  const [rating, setRating] = useState("3");
  const [notes, setNotes] = useState("");
  const [responses, setResponses] = useState([]);
  const assessment = evaluatePostDraft(draft);
  const summary = summarizeAudienceFeedback(responses.map(row => row.rating));
  function addResponse(event) {
    event.preventDefault();
    const numeric = Number(rating);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5 || !draft.trim()) return;
    setResponses(previous => [...previous, { rating: numeric, note: notes.trim().slice(0, 1000) }]);
    setNotes("");
  }
  return <div className="space-y-6">
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">Post review & audience feedback</h2>
        <p className="text-sm text-muted-foreground">Check an unpublished draft, then enter ratings actually provided by reviewers. Nothing is posted, submitted or inferred about people. Review notes stay in this browser session and are cleared when you leave the workspace.</p>
      </header>
      <label className="block text-sm font-medium">Post draft to review
        <textarea rows={5} value={draft} maxLength={4000} onChange={e => {setDraft(e.target.value); setResponses([]);}}
          className="mt-2 w-full rounded-xl border border-input bg-background p-3" placeholder="Paste a message you're considering publishing…" />
      </label>
      {assessment.score !== null && <section aria-label="Editorial checklist" className="space-y-3 rounded-xl border p-4">
        <p className="font-semibold">Editorial checklist: {assessment.score}/100</p>
        <p className="text-xs text-muted-foreground">This is a transparent, equal-weight content checklist—not an AI audience prediction, verified audience rating, donation forecast, or scientific effectiveness score. Edit the post and retest with real readers.</p>
        <ul className="space-y-2 text-sm">{assessment.items.map(item => <li key={item.label}>{item.pass ? "✓ " : "Needs review: "}{item.label}</li>)}</ul>
      </section>}
      <form onSubmit={addResponse} className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">Record an actual reviewer's response</h3>
        <p className="text-sm text-muted-foreground">Ask the reviewer whether the message is understandable, trustworthy and worth sharing, without prompting a particular answer. Only enter feedback they actually gave.</p>
        <label className="block text-sm">Reviewer's rating (1–5)
          <select value={rating} onChange={e => setRating(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3">
            {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>{n} / 5</option>)}
          </select>
        </label>
        <label className="block text-sm">Anonymous feedback (optional)
          <textarea rows={2} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-background p-3" placeholder="What did the reviewer understand or find confusing?" />
        </label>
        <button type="submit" disabled={!draft.trim()} className="ifund-interactive min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white disabled:opacity-50">Record feedback locally</button>
      </form>
      <section aria-label="Observed audience feedback" className="space-y-2">
        <h3 className="font-semibold">Observed reviewer ratings</h3>
        <p role="status" className="text-sm">{summary.count === 0 ? "No audience feedback recorded." : summary.count + " actual response(s) · average " + summary.mean.toFixed(1) + " / 5"}</p>
        {summary.count > 0 && <p className="text-xs text-muted-foreground">{summary.count < 5
          ? "Early directional feedback only. A small qualitative round of about five reviewers can help identify wording problems."
          : "Ratings describe this selected group only. Small qualitative samples do not establish a representative audience score or reliably predict fundraising outcomes."}</p>}
        <ol className="space-y-1 text-sm">{responses.map((row, index) => <li key={index}>Review {index + 1}: {row.rating}/5{row.note ? " · " + row.note : ""}</li>)}</ol>
        {summary.count > 0 && <button type="button" onClick={() => setResponses([])} className="min-h-11 rounded-lg border px-4">Clear recorded feedback</button>}
      </section>
      <p className="text-xs text-muted-foreground">Research basis: Nielsen Norman Group on clear, concise, scannable writing and the distinction between small qualitative studies and statistically representative quantitative ratings. The checklist's five equal weights are an iFund editorial design choice, not weights validated by these studies. References: <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.nngroup.com/articles/ux-writing-faqs/">UX writing</a> · <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.nngroup.com/articles/5-test-users-qual-quant/">Qualitative vs quantitative testing</a>.</p>
    </section>
    <CampaignEngagement />
  </div>;
}
