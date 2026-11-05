import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
const button = "min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50";
const empty = {
  message_id: null,
  revision: null,
  campaign_id: "",
  subject: "",
  content: "",
  comm_type: "update",
};
async function api(path, body) {
  const { data, error } = await authClient().auth.getSession();
  if (error || !data?.session?.access_token)
    throw Error("Please sign in again.");
  const r = await fetch("/api/agents/communications/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  const result = await r.json().catch(() => ({
    error: "The message service is temporarily unavailable.",
  }));
  if (!r.ok)
    throw Object.assign(
      Error(result.error || "Your message could not be saved."),
      { status: r.status, code: result.code },
    );
  return result;
}
export default function CommunicationsAgent() {
  const [workspace, setWorkspace] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(empty),
    [details, setDetails] = useState(""),
    [selected, setSelected] = useState([]),
    [review, setReview] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [outcomes, setOutcomes] = useState([]),
    [uncertain, setUncertain] = useState(false);
  const saveRef = useRef(null),
    draftRef = useRef(null),
    reviewRef = useRef(null),
    retryRef = useRef(null);
  const messages = workspace?.messages || [],
    drafts = messages.filter((m) => m.status === "draft"),
    group = drafts.slice(0, 50),
    locked = busy || !!review || uncertain;
  useEffect(() => {
    let active = true;
    api("workspace")
      .then((w) => {
        if (active) setWorkspace(w);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function reload() {
    if (busy) return;
    setBusy(true);
    setError("");
    setOutcomes([]);
    try {
      setWorkspace(await api("workspace"));
      setSelected([]);
      setReview(null);
      setUncertain(false);
      setForm(empty);
      saveRef.current = null;
      reviewRef.current = null;
      retryRef.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function failed(e, retry) {
    setError(e.message);
    if (!e.status || e.status >= 500) {
      setUncertain(true);
      retryRef.current = retry;
    } else {
      setUncertain(false);
      retryRef.current = null;
    }
  }
  async function save(event) {
    event?.preventDefault();
    if (busy || review) return;
    setBusy(true);
    setError("");
    setNotice("");
    setOutcomes([]);
    const fingerprint = JSON.stringify(form);
    if (saveRef.current?.fingerprint !== fingerprint)
      saveRef.current = {
        fingerprint,
        body: { ...form, operation_id: crypto.randomUUID() },
      };
    try {
      await api("save", saveRef.current.body);
      setWorkspace(await api("workspace"));
      setForm(empty);
      setUncertain(false);
      saveRef.current = null;
      retryRef.current = null;
      setNotice("Your draft is saved. Review it before sending.");
    } catch (e) {
      failed(e, () => save());
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (busy || review) return;
    setBusy(true);
    setError("");
    setNotice("");
    setOutcomes([]);
    const body = {
      campaign_id: form.campaign_id,
      comm_type: form.comm_type,
      details,
    };
    const fingerprint = JSON.stringify(body);
    if (draftRef.current?.fingerprint !== fingerprint)
      draftRef.current = {
        fingerprint,
        body: { ...body, request_id: crypto.randomUUID() },
      };
    try {
      await api("drafts", draftRef.current.body);
      setWorkspace(await api("workspace"));
      draftRef.current = null;
      setUncertain(false);
      retryRef.current = null;
      setNotice(
        "Your AI-assisted draft is saved for review. It has not been sent.",
      );
    } catch (e) {
      if (e.code === "new_request_required") {
        draftRef.current = null;
        setUncertain(false);
        setError(e.message);
      } else failed(e, () => generate());
    } finally {
      setBusy(false);
    }
  }
  function selection() {
    return drafts
      .filter((m) => selected.includes(m.id))
      .map((m) => ({ id: m.id, revision: m.updated_at }));
  }
  async function prepareSend() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setOutcomes([]);
    if (!reviewRef.current || reviewRef.current.kind !== "send")
      reviewRef.current = {
        kind: "send",
        body: { preview_id: crypto.randomUUID(), items: selection() },
      };
    try {
      const data = await api("prepare-send", reviewRef.current.body);
      setReview({ kind: "send", ...data });
      setUncertain(false);
      retryRef.current = null;
    } catch (e) {
      failed(e, () => prepareSend());
    } finally {
      setBusy(false);
    }
  }
  function prepareCancel() {
    if (busy || !selected.length) return;
    reviewRef.current = {
      kind: "cancel",
      body: { operation_id: crypto.randomUUID(), items: selection() },
    };
    setOutcomes([]);
    setReview({
      kind: "cancel",
      messages: drafts.filter((m) => selected.includes(m.id)),
    });
    setError("");
  }
  async function confirm() {
    if (busy || !review) return;
    setBusy(true);
    setError("");
    setNotice("");
    setOutcomes([]);
    const snapshot = review;
    try {
      const result = await api(
        snapshot.kind === "send" ? "send" : "cancel",
        snapshot.kind === "send"
          ? { preview_id: snapshot.preview_id, confirm_owner_review: true }
          : reviewRef.current.body,
      );
      if (snapshot.kind === "send")
        setOutcomes(
          (result.outcomes || []).map((o) => ({
            ...o,
            title:
              snapshot.messages.find((m) => m.id === o.id)?.subject ||
              "Message",
          })),
        );
      else
        setNotice(
          `${result.cancelled} draft${result.cancelled === 1 ? "" : "s"} cancelled.`,
        );
      setWorkspace(await api("workspace"));
      setSelected([]);
      setReview(null);
      reviewRef.current = null;
      setUncertain(false);
      retryRef.current = null;
    } catch (e) {
      failed(e, () => confirm());
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-28 sm:p-7">
      <nav aria-label="AI assistants" className="flex flex-wrap gap-5">
        <Link to="/agents" className="min-h-11 underline">
          Story
        </Link>
        <Link to="/agents/strategy" className="min-h-11 underline">
          Strategy
        </Link>
        <Link to="/agents/growth" className="min-h-11 underline">
          Growth
        </Link>
        <span aria-current="page">Communications</span>
      </nav>
      <header>
        <h1 className="text-3xl font-semibold">Supporter updates</h1>
        <p className="mt-3 text-muted-foreground">
          Write an update or a thank-you. Review the exact text and audience
          before sending it inside IFund.
        </p>
      </header>
      {loading && <p role="status">Loading your messages…</p>}
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
      {uncertain && (
        <div className="space-y-3 rounded-xl border p-4">
          <p>
            The result could not be confirmed. Retry the same request or reload
            to check what was saved.
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() => retryRef.current?.()}
          >
            Retry same request
          </button>
        </div>
      )}
      <button className={button} disabled={busy} onClick={reload}>
        Reload saved messages
      </button>
      {workspace && (
        <>
          <p className="text-sm text-muted-foreground">
            Manual messages do not require an AI plan. Email and
            recurring-supporter audiences are not available here yet. Supporters
            can change their update preferences in{" "}
            <Link className="underline" to="/profile">
              My profile
            </Link>
            .
          </p>
          {!workspace.delivery_available && (
            <p role="status">
              Sending is off in this preview. You can save and review drafts.
            </p>
          )}
          <form className="space-y-4 rounded-xl border p-4" onSubmit={save}>
            <h2 className="text-xl font-semibold">
              {form.message_id ? "Edit your draft" : "Write a message"}
            </h2>
            <label className="block">
              Campaign
              <select
                aria-label="Campaign"
                required
                disabled={locked}
                className="mt-2 min-h-11 w-full rounded-lg border bg-background p-2"
                value={form.campaign_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, campaign_id: e.target.value }))
                }
              >
                <option value="">Choose your campaign</option>
                {workspace.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Message type
              <select
                aria-label="Message type"
                disabled={locked}
                className="mt-2 min-h-11 w-full rounded-lg border bg-background p-2"
                value={form.comm_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, comm_type: e.target.value }))
                }
              >
                {[
                  ["update", "Update"],
                  ["thank_you", "Thank you"],
                  ["announcement", "Announcement"],
                  ["milestone", "Milestone"],
                  ["volunteer", "Volunteer update"],
                  ["sponsor", "Sponsor update"],
                ].map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Subject
              <input
                required
                maxLength={200}
                disabled={locked}
                className="mt-2 min-h-11 w-full rounded-lg border bg-background p-3"
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
              />
            </label>
            <label className="block">
              Message
              <textarea
                required
                maxLength={4000}
                disabled={locked}
                className="mt-2 min-h-40 w-full rounded-lg border bg-background p-3"
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className={button} disabled={locked}>
                Save draft
              </button>
              {form.message_id && (
                <button
                  className={button}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setForm(empty);
                    saveRef.current = null;
                  }}
                >
                  Write a new message
                </button>
              )}
            </div>
          </form>
          {workspace.ai_available && (
            <section className="space-y-3 rounded-xl border p-4">
              <h2 className="text-xl font-semibold">Get help with a draft</h2>
              <label className="block">
                What should your supporters know?
                <textarea
                  maxLength={2000}
                  disabled={locked}
                  className="mt-2 min-h-24 w-full rounded-lg border bg-background p-3"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </label>
              <p className="text-sm">
                Uses the campaign and message type selected above. Your existing
                text is kept until you choose an AI draft.
              </p>
              <button
                className={button}
                disabled={locked || !form.campaign_id || !details.trim()}
                onClick={generate}
              >
                Prepare a message draft
              </button>
            </section>
          )}
          <section className="space-y-4" aria-label="Saved messages">
            <h2 className="text-2xl font-semibold">Saved messages</h2>
            <p className="text-sm">
              Showing up to 100 saved messages. Only the loaded drafts you
              select are included in a batch.
            </p>
            {drafts.length > 0 && (
              <>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={
                      group.length > 0 &&
                      group.every((m) => selected.includes(m.id))
                    }
                    onChange={(e) => {
                      setSelected(
                        e.target.checked ? group.map((m) => m.id) : [],
                      );
                      reviewRef.current = null;
                    }}
                  />
                  Select {group.length} loaded drafts
                </label>
                <p>{selected.length} selected</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={button}
                    disabled={locked}
                    onClick={() => {
                      setSelected(drafts.slice(0, 5).map((m) => m.id));
                      reviewRef.current = null;
                    }}
                  >
                    Select first {Math.min(5, drafts.length)} for review
                  </button>
                  <button
                    className={button}
                    disabled={locked || !selected.length || selected.length > 5}
                    onClick={prepareSend}
                  >
                    Review for sending
                  </button>
                  <button
                    className={button}
                    disabled={
                      locked || !selected.length || selected.length > 50
                    }
                    onClick={prepareCancel}
                  >
                    Cancel selected drafts
                  </button>
                </div>
                <p className="text-sm">
                  Review up to 5 messages for sending, or cancel up to 50
                  drafts.
                </p>
              </>
            )}
            {review && (
              <section
                aria-label="Owner message review"
                className="space-y-4 rounded-xl border border-primary p-4"
              >
                <h3 className="text-xl font-semibold">
                  {review.kind === "send"
                    ? "Review these supporter updates"
                    : "Cancel these drafts?"}
                </h3>
                {review.messages.map((m) => (
                  <article
                    key={m.id}
                    className="space-y-2 border-b pb-4 break-words"
                  >
                    <h4 className="font-semibold">{m.subject}</h4>
                    {review.kind === "send" && (
                      <>
                        <p>
                          {m.campaign_title} · {m.eligible_recipients} eligible
                          supporters in IFund
                        </p>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </>
                    )}
                  </article>
                ))}
                {review.kind === "send" && (
                  <p className="text-sm">
                    Only the supporters counted in this review can receive these
                    messages. People who opt out or are no longer eligible will
                    be excluded. No email will be sent.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    className={button}
                    disabled={
                      busy ||
                      uncertain ||
                      (review.kind === "send" && !workspace.delivery_available)
                    }
                    onClick={confirm}
                  >
                    {review.kind === "send"
                      ? "Send these updates in IFund"
                      : "Confirm cancellation"}
                  </button>
                  <button
                    className={button}
                    disabled={busy || uncertain}
                    onClick={() => {
                      setReview(null);
                      reviewRef.current = null;
                    }}
                  >
                    Back to drafts
                  </button>
                </div>
              </section>
            )}
            {outcomes.length > 0 && (
              <div role="status" className="space-y-2 rounded-xl border p-4">
                {outcomes.map((o) => (
                  <p className="break-words" key={o.id}>
                    {o.title}:{" "}
                    {o.status === "sent_in_app"
                      ? `sent inside IFund to ${o.delivered} supporter${o.delivered === 1 ? "" : "s"}`
                      : "no eligible supporters; kept as a draft"}
                    .
                    {o.excluded_since_review > 0
                      ? ` ${o.excluded_since_review} excluded since review.`
                      : ""}
                  </p>
                ))}
              </div>
            )}
            {messages.length === 0 && <p>No saved messages yet.</p>}
            {messages.map((m) => (
              <article
                className="space-y-3 rounded-xl border p-4 break-words"
                key={m.id}
              >
                <h3 className="font-semibold">{m.subject}</h3>
                <p className="text-sm">
                  {m.campaign_title} ·{" "}
                  {m.status === "sent" ? "sent inside IFund" : m.status}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.status === "draft" && (
                  <div className="flex flex-wrap gap-4">
                    <label className="flex min-h-11 items-center gap-3">
                      <input
                        aria-label={"Select " + m.subject}
                        type="checkbox"
                        disabled={locked}
                        checked={selected.includes(m.id)}
                        onChange={(e) => {
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, m.id]
                              : s.filter((id) => id !== m.id),
                          );
                          reviewRef.current = null;
                        }}
                      />
                      Select draft
                    </label>
                    <button
                      className={button}
                      disabled={locked}
                      onClick={() => {
                        setForm({
                          message_id: m.id,
                          revision: m.updated_at,
                          campaign_id: m.campaign_id,
                          subject: m.subject,
                          content: m.content,
                          comm_type: m.comm_type,
                        });
                        saveRef.current = null;
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit draft
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
