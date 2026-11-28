import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { answerDisasterCheckin } from "@/lib/disasterCheckins";

// One disaster check-in: the platform asks a campaign owner whether they
// need emergency assistance because an authoritative disaster alert matches
// their campaign's area. In-app only — no email, no external post, no money
// moves. One clear primary action (Yes); No is the secondary action. The
// answer is final for the event and is never re-asked.
export default function DisasterCheckinCard({ checkin, client, onAnswered }) {
  const [answered, setAnswered] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function answer(value) {
    if (busy || answered) return;
    setBusy(true);
    setError("");
    try {
      await answerDisasterCheckin(client, checkin.checkin_id, value);
      setAnswered(value);
    } catch (cause) {
      setError(cause?.message || "Your answer could not be recorded. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const disasterLabel = String(checkin.disaster_type || "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

  if (answered) {
    return (
      <article className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4" aria-label="Disaster check-in answered">
        <h2 className="font-semibold">
          {answered === "yes" ? "Thank you — your campaign is now flagged for disaster relief." : "Thank you — we're glad you're safe."}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {answered === "yes"
            ? "Your campaign now carries the disaster-relief badge and appears first in Discover. You will not be asked again about this disaster."
            : "Your answer has been recorded. You will not be asked again about this disaster."}
        </p>
        <button
          type="button"
          onClick={() => onAnswered?.(checkin)}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"
        >
          Dismiss
        </button>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4" aria-label="Disaster check-in">
      <h2 className="flex items-start gap-2 font-semibold">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{checkin.alert_title}</span>
      </h2>
      <dl className="mt-3 space-y-1 text-sm">
        {checkin.alert_area && (
          <div className="flex gap-2"><dt className="font-semibold text-muted-foreground">Area</dt><dd>{checkin.alert_area}</dd></div>
        )}
        {disasterLabel && (
          <div className="flex gap-2"><dt className="font-semibold text-muted-foreground">Disaster</dt><dd>{disasterLabel}{checkin.severity ? ` · ${checkin.severity}` : ""}</dd></div>
        )}
        <div className="flex gap-2"><dt className="font-semibold text-muted-foreground">Campaign</dt><dd>{checkin.campaign_title}</dd></div>
        {checkin.asked_at && (
          <div className="flex gap-2"><dt className="font-semibold text-muted-foreground">Asked</dt><dd>{new Date(checkin.asked_at).toLocaleString()}</dd></div>
        )}
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">
        Are you in need of emergency assistance because of this?
      </p>
      {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer("yes")}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Recording…" : "Yes, I need emergency assistance"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer("no")}
          className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          No, I&rsquo;m safe
        </button>
      </div>
    </article>
  );
}
