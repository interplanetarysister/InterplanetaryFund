import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import {
  readWritingHandoff,
  forgetWritingHandoff,
  WritingHandoffError,
} from "@/lib/writingCampaignHandoff";

export default function WritingDraftReview({
  ownerId,
  campaignId = null,
  disabled = false,
  onApply,
  onBusyChange,
}) {
  const [params, setParams] = useSearchParams();
  const id = params.get("writing");
  const record = useMemo(() => {
    try {
      return readWritingHandoff(sessionStorage, { ownerId, id, campaignId });
    } catch {
      return null;
    }
  }, [ownerId, id, campaignId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const alive = useRef(true);
  const scope = JSON.stringify([ownerId, campaignId, id]);
  const currentScope = useRef(scope);
  const operationRef = useRef(null);
  if (currentScope.current !== scope) {
    currentScope.current = scope;
    operationRef.current = null;
  }
  useEffect(() => {
    if (operationRef.current?.scope !== scope) {
      setBusy(false);
      setError("");
      onBusyChange?.(false);
    }
  }, [scope, onBusyChange]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      onBusyChange?.(false);
    };
  }, []);

  async function finish(apply) {
    if (operationRef.current?.scope === scope || disabled) return;
    const operation = { scope };
    operationRef.current = operation;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const { data, error: authError } = await authClient().auth.getUser();
      if (
        !alive.current ||
        currentScope.current !== scope ||
        operationRef.current !== operation
      )
        return;
      if (authError || !ownerId || data?.user?.id !== ownerId)
        throw new WritingHandoffError(
          "Your account changed. Reopen your saved writing to continue.",
        );
      const current = readWritingHandoff(sessionStorage, {
        ownerId,
        id,
        campaignId,
      });
      if (!current)
        throw new WritingHandoffError(
          "This writing link has expired. Open your saved writing and continue again.",
        );
      if (JSON.stringify(current.copy) !== JSON.stringify(record?.copy))
        throw new WritingHandoffError(
          "This writing changed. Reopen it before choosing what to use.",
        );
      if (!alive.current) return;
      if (apply) onApply(current.copy);
      try {
        forgetWritingHandoff(sessionStorage, { ownerId, id, campaignId });
      } catch {
        /* already copied into the editor */
      }
      const next = new URLSearchParams(params);
      next.delete("writing");
      setParams(next, { replace: true });
      setNotice({
        ownerId,
        text: apply
          ? "Your writing is in the editor. Review the campaign details below, then save or publish."
          : "Your current campaign text is kept.",
      });
    } catch (cause) {
      if (alive.current && currentScope.current === scope)
        setError(
          cause instanceof WritingHandoffError
            ? cause.message
            : "Your writing could not be opened. Your saved draft is still available.",
        );
    } finally {
      if (operationRef.current === operation) {
        operationRef.current = null;
        if (alive.current && currentScope.current === scope) {
          setBusy(false);
          onBusyChange?.(false);
        }
      }
    }
  }
  const current =
    record?.owner_id === ownerId &&
    record?.id === id &&
    record?.campaign_id === campaignId
      ? record
      : null;
  if (!id)
    return notice?.ownerId === ownerId ? (
      <p role="status" className="rounded-xl border p-4">
        {notice.text}
      </p>
    ) : null;
  if (!current)
    return (
      <p role="status" className="rounded-xl border p-4">
        This writing link is unavailable for this account or campaign.{" "}
        <Link to="/agents" className="underline">
          Open your saved writing
        </Link>
      </p>
    );
  return (
    <section
      aria-label="Review saved writing"
      className="space-y-4 rounded-2xl border border-primary/40 bg-card p-5 sm:p-8"
    >
      <h2 className="text-xl font-semibold">Review your saved writing</h2>
      <p className="text-sm">
        Use this writing to replace the title, short description and story in
        the editor below.
      </p>
      <dl className="space-y-3 break-words">
        {[
          ["title", "Title"],
          ["summary", "Short description"],
          ["story", "Story"],
        ].map(([key, label]) => (
          <div key={key}>
            <dt className="font-semibold">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap">{current.copy[key]}</dd>
          </div>
        ))}
      </dl>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => finish(true)}
          className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Opening…" : "Use this writing"}
        </button>
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => finish(false)}
          className="min-h-12 rounded-xl border px-5 disabled:opacity-50"
        >
          Keep my current writing
        </button>
      </div>
    </section>
  );
}
