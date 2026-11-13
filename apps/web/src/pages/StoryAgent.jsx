import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { loadWritingWorkspaceAccess } from "@/lib/writingWorkspace";
import { loadOwnerCampaign } from "@/api/ownerCampaigns";
import { analyzeStoryBrief } from "@/lib/campaignWritingChecklist.mjs";
import StoryVoicePreferences from "@/components/agents/StoryVoicePreferences";
import {
  rememberWritingHandoff,
  WritingHandoffError,
} from "@/lib/writingCampaignHandoff";

export default function StoryAgent() {
  const navigate = useNavigate();
  const [details, setDetails] = useState("");
  const [section, setSection] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [queuedRequests, setQueuedRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(null);
  const [preferenceEpoch, setPreferenceEpoch] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestRef = useRef(null);
  const ownerRef = useRef(null);
  const alive = useRef(true);
  const handoffLock = useRef(false);
  async function api(path, body) {
    const client = authClient();
    const { data, error } = await client.auth.getSession();
    const actorId = data?.session?.user?.id;
    if (error || !data?.session?.access_token || !actorId)
      throw Error("Sign in to use your writing assistant.");
    const res = await fetch("/api/services/story_agent/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + data.session.access_token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(90000),
    });
    let result;
    try {
      result = await res.json();
    } catch {
      throw Error(
        "The writing assistant is not available yet. Your text is safe.",
      );
    }
    const current = await client.auth.getSession();
    if (
      current.error ||
      current.data?.session?.user?.id !== actorId ||
      (ownerRef.current && ownerRef.current !== actorId)
    )
      throw Error(
        "Your account changed. Reopen your saved writing to continue.",
      );
    if (!res.ok)
      throw Object.assign(
        Error(
          result.error || "Your draft could not be prepared. Please try again.",
        ),
        { code: result.code },
      );
    ownerRef.current = actorId;
    return result;
  }
  async function continueWriting(draft, selection, target) {
    if (busy || handoffLock.current) return;
    handoffLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const client = authClient();
      const expectedOwner = ownerRef.current;
      const first = await client.auth.getUser();
      if (
        first.error ||
        !expectedOwner ||
        first.data?.user?.id !== expectedOwner
      )
        throw new WritingHandoffError(
          "Your account changed. Reopen your saved writing to continue.",
        );
      const destination = draft.campaign_id || target || null;
      if (destination) await loadOwnerCampaign(client, destination);
      const current = await client.auth.getUser();
      if (current.error || current.data?.user?.id !== expectedOwner)
        throw new WritingHandoffError(
          "Your account changed. Reopen your saved writing to continue.",
        );
      if (!alive.current) return;
      const handoff = rememberWritingHandoff(sessionStorage, {
        ownerId: expectedOwner,
        draft,
        selection,
        campaignId: destination,
      });
      navigate(handoff.target);
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof WritingHandoffError
            ? cause.message
            : "The campaign editor could not be opened. Your writing is still saved.",
        );
    } finally {
      handoffLock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    let active = true;
    (async () => {
      const workspace = await loadWritingWorkspaceAccess(api);
      if (!active) return;
      setQueuedRequests(workspace.queued_requests);
      const access = workspace.access;
      if (!access) {
        setEligible(false);
        throw Error(
          "Writing suggestions are temporarily unavailable. You can still remove your saved requests.",
        );
      }
      setEligible(access.active === true && access.level >= 1);
      if (!access.active || access.level < 1) return;
      const [result, owned] = await Promise.all([
        api("drafts"),
        (async () => {
          const client = authClient();
          const {
            data: { user },
            error,
          } = await client.auth.getUser();
          if (error || !user) throw Error("Please sign in again.");
          const response = await client
            .from("ifund_campaigns")
            .select("id,title")
            .eq("owner_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(50);
          if (response.error)
            throw Error("Your campaigns could not be loaded.");
          return response.data;
        })(),
      ]);
      if (active) {
        setDrafts(result.drafts);
        if (result.queued_requests) setQueuedRequests(result.queued_requests);
        setCampaigns(owned);
      }
    })()
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, []);
  async function generate(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const input = {
      details,
      campaign_id: campaignId || null,
      section: section || null,
    };
    const fingerprint = JSON.stringify(input);
    if (requestRef.current?.fingerprint !== fingerprint)
      requestRef.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await api("drafts", {
        ...input,
        request_id: requestRef.current.id,
      });
      if (result.state === "queued") {
        setNotice(result.message);
        const saved = await api("drafts");
        setQueuedRequests(saved.queued_requests || []);
        return;
      }
      setDrafts((current) => [
        result.draft,
        ...current.filter((d) => d.id !== result.draft.id),
      ]);
      setNotice(
        "Your private suggestion is saved below. Review it before using any text.",
      );
      const completedRequestId = requestRef.current?.id;
      requestRef.current = null;
      setQueuedRequests((current) =>
        current.filter((item) => item.request_id !== completedRequestId),
      );
    } catch (err) {
      if (err.code === "new_request_required") requestRef.current = null;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("cancel", { draft_id: id });
      setDrafts((current) =>
        current.map((d) => (d.id === id ? { ...d, status: "cancelled" } : d)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSelection(suggestion, choices, operationId) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("select", {
        operation_id: operationId,
        draft_id: suggestion.id,
        revision: suggestion.updated_at,
        ...choices,
      });
      setDrafts((current) => [
        result.draft,
        ...current.filter((d) => d.id !== result.draft.id),
      ]);
      setNotice(
        "Your selected wording is saved for review. Your campaign has not changed.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function reviseDraft(draft, payload) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await api("revise", {
        draft_id: draft.id,
        revision: draft.updated_at,
        payload,
      });
      setDrafts((current) =>
        current.map((d) => (d.id === updated.id ? updated : d)),
      );
      setNotice(
        "Your wording edits are saved for review. Your campaign has not changed.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshDrafts() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("drafts");
      setDrafts(result.drafts);
      setQueuedRequests(result.queued_requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const briefAudit = analyzeStoryBrief(details);
  return (
    <div className="mx-auto max-w-3xl space-y-7 p-4 pb-24 sm:p-7">
      <header>
        <h1 className="text-3xl font-semibold">Your writing assistant</h1>
        <p className="mt-3 text-muted-foreground">
          Tell your campaign’s story in your own voice. Suggestions are private
          and saved for your review.
        </p>
      </header>
      {loading && <p role="status">Loading your drafts…</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive p-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border p-4">
          {notice}
        </p>
      )}
      <section className="rounded-2xl border border-border bg-card p-5" aria-label="Free campaign brief review">
        <h2 className="text-lg font-semibold">Free Story briefing checklist</h2>
        <p className="mt-2 text-sm text-muted-foreground">This local writing guide does not use an AI model, consume credits, or transmit your text. Its checks are prompts for your own review, not fact verification.</p>
        <p className="mt-2 text-sm text-muted-foreground">Current draft: {briefAudit.words} words. Enter a draft in “What should people know?” to see suggestions.</p>
        {briefAudit.sensitive && <p role="alert" className="mt-3 rounded-lg border border-amber-500/50 p-3 text-sm">Your draft might contain sensitive credentials or identification. Remove them before generating or publishing.</p>}
        <ul className="mt-3 space-y-2">
          {briefAudit.checks.map(check => <li key={check.id} className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-semibold">{check.label}</span>
            <span className="text-muted-foreground">{check.suggested ? check.prompt : "Review for accuracy before publishing."}</span>
          </li>)}
        </ul>
      </section>
      {queuedRequests.length > 0 && (
        <section
          className="rounded-xl border p-4"
          aria-label="Saved writing requests"
        >
          <h2 className="font-semibold">Saved writing requests</h2>
          <p className="my-2 text-sm text-muted-foreground">
            Your text is saved while free capacity is busy. Load a request to
            resume it when capacity is available.
          </p>
          {queuedRequests.map((item) => (
            <div
              key={item.request_id}
              className="flex flex-wrap items-center gap-3"
            >
              <button
                disabled={
                  busy || item.can_resume === false || eligible === false
                }
                className="my-1 block rounded-lg border px-3 py-2"
                onClick={() => {
                  const restored = {
                    details: item.task.details,
                    campaign_id: item.campaign_id || null,
                    section: item.task.section || null,
                  };
                  setDetails(restored.details);
                  setCampaignId(restored.campaign_id || "");
                  setSection(restored.section || "");
                  requestRef.current = {
                    id: item.request_id,
                    fingerprint: JSON.stringify(restored),
                  };
                  setNotice(
                    "Your saved text is loaded. Request a suggestion below to resume it.",
                  );
                }}
              >
                Load saved request
              </button>
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2"
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  setError("");
                  try {
                    await api("cancel-queued", { request_id: item.request_id });
                    setQueuedRequests((current) =>
                      current.filter(
                        (saved) => saved.request_id !== item.request_id,
                      ),
                    );
                    if (requestRef.current?.id === item.request_id)
                      requestRef.current = null;
                    setNotice("The saved request has been removed.");
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Remove saved request
              </button>
            </div>
          ))}
        </section>
      )}
      {eligible === false && (
        <p role="status">
          The writing assistant requires an eligible AI plan. Your account does
          not have verified access yet.
        </p>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await api("clear-preferences", { all_scopes: true });
            setNotice("Your saved writing preferences have been cleared.");
            setPreferenceEpoch((current) => current + 1);
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
        className="min-h-11 underline"
      >
        Clear all saved writing preferences
      </button>
      {eligible === true && (
        <form onSubmit={generate} className="space-y-5 rounded-2xl border p-5">
          <label className="block">
            Campaign (optional)
            <select
              aria-label="Campaign (optional)"
              disabled={busy || loading}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border bg-background px-3"
            >
              <option value="">Start a new campaign idea</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || "Untitled campaign"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            What should people know?
            <textarea
              required
              minLength={12}
              maxLength={4000}
              rows={6}
              disabled={busy}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="mt-2 w-full rounded-xl border bg-background p-3"
            />
            <span className="mt-1 block text-sm text-muted-foreground">
              Include the real need, who benefits, your preferred tone, and
              anything that must stay unchanged.
            </span>
          </label>
          <StoryVoicePreferences disabled={busy} onApply={preference=>{
            const addition="\n\nPreferred writing voice (style only; preserve all verified facts): "+preference;
            setDetails(value=>value.includes(addition)?value:(value+addition).slice(0,4000));
          }}/>
          <label className="block">
            Rewrite one story section (optional)
            <textarea
              maxLength={4000}
              rows={4}
              disabled={busy}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="mt-2 w-full rounded-xl border bg-background p-3"
            />
          </label>
          <button
            disabled={busy || loading || details.trim().length < 12}
            className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? "Preparing your draft…"
              : section.trim()
                ? "Suggest a section rewrite"
                : "Suggest titles, summaries and a story"}
          </button>
        </form>
      )}
      {eligible === true && (
        <StoryPreferences
          key={(campaignId || "owner") + ":" + preferenceEpoch}
          campaignId={campaignId || null}
          api={api}
          busy={busy}
          setBusy={setBusy}
        />
      )}
      {eligible === true && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">Your saved suggestions</h2>
          {!loading && !error && drafts.length === 0 && (
            <p>No saved suggestions yet.</p>
          )}
          <button
            disabled={busy}
            onClick={refreshDrafts}
            className="min-h-11 underline"
          >
            Refresh saved drafts
          </button>
          {drafts.map((d) => (
            <StoryDraft
              key={d.id + ":" + (d.updated_at || "")}
              draft={d}
              campaigns={campaigns}
              busy={busy}
              onSelect={saveSelection}
              onRevise={reviseDraft}
              onCancel={cancel}
              onContinue={continueWriting}
            />
          ))}
        </section>
      )}
    </div>
  );
}

export function StoryDraft({
  draft,
  campaigns,
  busy,
  onSelect,
  onRevise,
  onCancel,
  onContinue,
}) {
  const [titleIndex, setTitleIndex] = useState(0);
  const [summaryIndex, setSummaryIndex] = useState(0);
  const [target, setTarget] = useState(draft.campaign_id || "");
  const [wording, setWording] = useState({
    title: draft.payload?.title || "",
    summary: draft.payload?.summary || "",
    story: draft.payload?.story || "",
  });
  const operation = useRef(null);
  const selected = draft.source_system === "ifund_story_accepted_v1";
  const cancelled = draft.status !== "draft";
  function choose() {
    const choices = {
      campaign_id: target,
      title_index: titleIndex,
      summary_index: summaryIndex,
    };
    const fingerprint = JSON.stringify(choices);
    if (operation.current?.fingerprint !== fingerprint)
      operation.current = { fingerprint, id: crypto.randomUUID() };
    onSelect(draft, choices, operation.current.id);
  }
  return (
    <article className="space-y-4 rounded-2xl border p-5">
      <p className="text-sm text-muted-foreground">
        {cancelled
          ? "Cancelled draft"
          : selected
            ? "Selected wording · awaiting your review"
            : "Private suggestion · review before using"}
      </p>
      {selected ? (
        <div className="space-y-4">
          {[
            ["title", "Title", 160],
            ["summary", "Summary", 500],
            ["story", "Story", 12000],
          ].map(([field, label, max]) => (
            <label key={field} className="block">
              {label}
              <textarea
                disabled={busy || cancelled}
                rows={field === "story" ? 6 : 2}
                maxLength={max}
                aria-label={label}
                value={wording[field]}
                onChange={(e) =>
                  setWording((current) => ({
                    ...current,
                    [field]: e.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border bg-background p-3"
              />
            </label>
          ))}
          {!cancelled && (
            <button
              disabled={busy || Object.values(wording).some((v) => !v.trim())}
              onClick={() => onRevise(draft, wording)}
              className="min-h-11 underline disabled:opacity-50"
            >
              Save wording edits
            </button>
          )}
        </div>
      ) : (
        <>
          {draft.payload?.titles && (
            <fieldset disabled={busy || cancelled} className="space-y-2">
              <legend className="font-semibold">Choose a title</legend>
              {draft.payload.titles.map((text, i) => (
                <label key={i} className="flex min-h-11 items-start gap-3">
                  <input
                    type="radio"
                    name={"title-" + draft.id}
                    checked={titleIndex === i}
                    onChange={() => setTitleIndex(i)}
                  />
                  <span>{text}</span>
                </label>
              ))}
            </fieldset>
          )}
          {draft.payload?.summaries && (
            <fieldset disabled={busy || cancelled} className="space-y-2">
              <legend className="font-semibold">Choose a summary</legend>
              {draft.payload.summaries.map((text, i) => (
                <label key={i} className="flex min-h-11 items-start gap-3">
                  <input
                    type="radio"
                    name={"summary-" + draft.id}
                    checked={summaryIndex === i}
                    onChange={() => setSummaryIndex(i)}
                  />
                  <span>{text}</span>
                </label>
              ))}
            </fieldset>
          )}
          <p className="whitespace-pre-wrap break-words">
            {draft.payload?.section || draft.payload?.story}
          </p>
          {draft.payload?.image_prompt && (
            <details>
              <summary className="min-h-11 cursor-pointer">
                Suggested visual direction
              </summary>
              <p>{draft.payload.image_prompt}</p>
            </details>
          )}
          {!cancelled && draft.payload?.titles && (
            <div className="space-y-3">
              <label className="block">
                Campaign for this wording
                <select
                  disabled={busy || Boolean(draft.campaign_id)}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border bg-background px-3"
                >
                  <option value="">Start a new campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title || "Untitled campaign"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || !target || !draft.updated_at}
                onClick={choose}
                className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                Save selected wording for review
              </button>
              <p className="text-sm text-muted-foreground">
                Your campaign stays unchanged until you separately review and
                apply a draft.
              </p>
            </div>
          )}
        </>
      )}
      {!cancelled &&
        draft.payload?.story &&
        (selected || draft.payload?.titles) && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy || !onContinue}
              onClick={() =>
                onContinue(
                  draft,
                  {
                    title_index: titleIndex,
                    summary_index: summaryIndex,
                    ...(selected ? { wording } : {}),
                  },
                  target,
                )
              }
              className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              Continue to campaign editor
            </button>
            <p className="text-sm text-muted-foreground">
              Review this writing in your campaign, add the remaining details,
              then choose Save private draft or Publish campaign.
            </p>
          </div>
        )}
      {!cancelled && (
        <button
          disabled={busy}
          onClick={() => onCancel(draft.id)}
          className="min-h-11 underline disabled:opacity-50"
        >
          Cancel this {selected ? "draft" : "suggestion"}
        </button>
      )}
    </article>
  );
}

function StoryPreferences({ campaignId, api, busy, setBusy }) {
  const [values, setValues] = useState({});
  const [revision, setRevision] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    api(
      "preferences" +
        (campaignId ? "?campaign_id=" + encodeURIComponent(campaignId) : ""),
    )
      .then((result) => {
        if (active) {
          setValues(result.preferences);
          setRevision(result.revision);
          setGeneration(result.generation || 0);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError("Your saved writing preferences could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [campaignId]);
  async function save(e) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("preferences", {
        campaign_id: campaignId,
        revision,
        generation,
        preferences: values,
      });
      setRevision(result.revision);
      setValues(result.preferences);
      setNotice(
        "Your preferences are saved. New corrections replace earlier preferences in this scope.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("clear-preferences", {
        campaign_id: campaignId,
      });
      setGeneration(result.generation);
      setValues({});
      setRevision(null);
      setReady(true);
      setNotice("Your saved preferences for this scope have been cleared.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">Writing preferences</h2>
      <p className="text-sm text-muted-foreground">
        {campaignId
          ? "These preferences apply only to the campaign selected above. They override your general preferences."
          : "These are your general preferences. Each campaign can have its own."}{" "}
        Use this for tone and instructions; keep passwords and connection
        details out.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form onSubmit={save} className="space-y-4">
        {[
          ["tone", "Preferred tone"],
          ["never_change", "What must stay unchanged?"],
          ["language", "Preferred language"],
          ["audience_hypothesis", "Audience ideas (optional)"],
        ].map(([field, label]) => (
          <label key={field} className="block">
            {label}
            <textarea
              rows={2}
              maxLength={1000}
              aria-label={label}
              disabled={busy || !ready}
              value={values[field] || ""}
              onChange={(e) =>
                setValues((current) => ({
                  ...current,
                  [field]: e.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border bg-background p-3"
            />
          </label>
        ))}
        <button
          disabled={busy || !ready}
          className="min-h-11 underline disabled:opacity-50"
        >
          Save preferences
        </button>
      </form>
      <button
        disabled={busy || !ready}
        onClick={clear}
        className="min-h-11 underline disabled:opacity-50"
      >
        Clear these preferences
      </button>
    </section>
  );
}
