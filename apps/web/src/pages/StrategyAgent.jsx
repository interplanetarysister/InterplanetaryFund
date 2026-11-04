import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

const button = "min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50";
async function planningApi(agent, path, body) {
  const { data, error } = await authClient().auth.getSession();
  if (error || !data?.session?.access_token)
    throw Error("Please sign in again.");
  const res = await fetch("/api/agents/" + agent + "/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  const result = await res.json().catch(() => ({
    error: "Your strategy assistant is temporarily unavailable.",
  }));
  if (!res.ok)
    throw Object.assign(
      Error(result.error || "Your changes could not be saved."),
      { code: result.code, status: res.status },
    );
  return result;
}
export default function StrategyAgent({ agent = "strategy" }) {
  const api = (path, body) => planningApi(agent, path, body);
  const growth = agent === "growth";
  const reportTitle = growth ? "Your growth report" : "Your Mission Brief";
  const prepareLabel = growth
    ? "Prepare growth report"
    : "Prepare my Mission Brief";
  const [workspace, setWorkspace] = useState(null),
    [eligible, setEligible] = useState(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [objective, setObjective] = useState(
    "Where should I focus my fundraising effort next?",
  );
  const [selected, setSelected] = useState([]),
    [campaignIds, setCampaignIds] = useState([]),
    [confirmation, setConfirmation] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const requestRef = useRef(null),
    operationRef = useRef(null);
  const recommendations = workspace?.recommendations || [];
  const group = recommendations.slice(0, 50);
  useEffect(() => {
    let active = true;
    (async () => {
      const access = await api("subscription");
      if (!active) return;
      setEligible(access.active === true && access.level >= 1);
      if (!access.active || access.level < 1) return;
      const result = await api("workspace");
      if (active) setWorkspace(result);
    })()
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
    try {
      setWorkspace(await api("workspace"));
      setSelected([]);
      setConfirmation(null);
      operationRef.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function generate(event) {
    event.preventDefault();
    if (busy || confirmation) return;
    setBusy(true);
    setError("");
    setNotice("");
    const scope = campaignIds.length ? campaignIds : undefined;
    if (
      requestRef.current?.objective !== objective ||
      JSON.stringify(requestRef.current?.campaign_ids) !== JSON.stringify(scope)
    )
      requestRef.current = {
        objective,
        request_id: crypto.randomUUID(),
        ...(scope ? { campaign_ids: scope } : {}),
      };
    try {
      const result = await api("brief", requestRef.current);
      setWorkspace(result.replayed ? await api("workspace") : result);
      setSelected([]);
      requestRef.current = null;
      setNotice("Your report is saved. Review the recommendations below.");
    } catch (e) {
      if (e.code === "new_request_required") requestRef.current = null;
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function review(status) {
    if (busy || !selected.length) return;
    const items = recommendations
      .filter((r) => selected.includes(r.id))
      .map((r) => ({ id: r.id, revision: r.updated_at }));
    operationRef.current = { operation_id: crypto.randomUUID(), items, status };
    setConfirmation({
      status,
      titles: recommendations
        .filter((r) => selected.includes(r.id))
        .map((r) => r.title),
      attempted: false,
    });
    setError("");
  }
  async function applyBatch() {
    if (busy || !operationRef.current) return;
    setBusy(true);
    setError("");
    setNotice("");
    setConfirmation((c) => ({ ...c, attempted: true }));
    try {
      const result = await api("bulk", operationRef.current);
      setNotice(
        `${result.changed} recommendation${result.changed === 1 ? "" : "s"} ${result.status === "open" ? "reopened" : result.status}.`,
      );
      // Reload canonical state after a replay: its original receipt may be older
      // than another tab's later decision. Never paint the receipt as current.
      setWorkspace(await api("workspace"));
      setSelected([]);
      setConfirmation(null);
      operationRef.current = null;
    } catch (e) {
      setError(
        e.message +
          (e.status === 409
            ? " Reload before choosing again."
            : " Retry this same selection or reload to check its saved status."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 pb-28 sm:p-7">
      <nav aria-label="AI assistants" className="flex gap-5">
        <Link className="min-h-11 underline" to="/agents">
          Story
        </Link>
        <Link
          className="min-h-11 underline"
          to="/agents/strategy"
          aria-current={!growth ? "page" : undefined}
        >
          Strategy
        </Link>
        <Link
          className="min-h-11 underline"
          to="/agents/growth"
          aria-current={growth ? "page" : undefined}
        >
          Growth
        </Link>
      </nav>
      <header>
        <h1 className="text-3xl font-semibold">
          {growth ? "Growth Lab" : "Mission Control"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          A clear plan for your campaigns, with priorities you can review and
          choose.
        </p>
      </header>
      {loading && <p role="status">Loading your report…</p>}
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
      {eligible === false && (
        <p>
          An eligible AI plan is required. Your account does not have verified
          access yet.
        </p>
      )}
      {eligible && (
        <>
          <form onSubmit={generate} className="space-y-3">
            <fieldset disabled={busy || !!confirmation} className="space-y-2">
              <legend className="font-medium">Campaign focus</legend>
              <p className="text-sm text-muted-foreground">
                Leave all unchecked for your 20 most recently updated campaigns,
                or select up to 10 to focus the plan.
              </p>
              {(workspace?.campaigns || []).map((c) => (
                <label key={c.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={campaignIds.includes(c.id)}
                    disabled={
                      !campaignIds.includes(c.id) && campaignIds.length >= 10
                    }
                    onChange={(e) =>
                      setCampaignIds((current) =>
                        e.target.checked
                          ? [...current, c.id]
                          : current.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.title}
                </label>
              ))}
              {workspace?.campaigns_truncated && (
                <p>Showing your 100 most recently updated campaigns.</p>
              )}
            </fieldset>
            <label htmlFor="strategy-question" className="block font-medium">
              What would you like to decide?
            </label>
            <textarea
              id="strategy-question"
              required
              maxLength={2000}
              value={objective}
              disabled={busy || !!confirmation}
              onChange={(e) => setObjective(e.target.value)}
              className="min-h-28 w-full rounded-xl border bg-background p-3"
            />
            <button
              className={button}
              disabled={loading || busy || !!confirmation || !objective.trim()}
            >
              {busy ? "Working…" : prepareLabel}
            </button>
          </form>
          <p className="text-sm text-muted-foreground">
            New reports replace open suggestions. Accepted and dismissed
            recommendations stay saved. Recommendations never change campaigns
            or publish content.
          </p>
          <button className={button} disabled={busy} onClick={reload}>
            Reload saved plan
          </button>
          {workspace && !workspace.brief && (
            <p>No report yet. Create a campaign, then ask for a plan.</p>
          )}
          {workspace?.brief && (
            <section
              aria-label="Mission Brief"
              className="space-y-5 rounded-xl border p-4"
            >
              <h2 className="text-2xl font-semibold">{reportTitle}</h2>
              <p className="whitespace-pre-wrap break-words">
                {workspace.brief.summary}
              </p>
              {[
                ["Today", "today_priorities"],
                ["This week", "week_priorities"],
                ["Long term", "long_term"],
                ["Risks", "risks"],
              ].map(([label, key]) => (
                <div key={key}>
                  <h3 className="font-semibold">{label}</h3>
                  <ul className="list-disc space-y-2 pl-5">
                    {(workspace.brief[key] || []).map((text, i) => (
                      <li className="break-words" key={i}>
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div>
                <h3 className="font-semibold">
                  Predictions · estimates, not guarantees
                </h3>
                {(workspace.brief.predictions || []).map((p, i) => (
                  <article className="mt-3 space-y-2 break-words" key={i}>
                    <p>{p.forecast}</p>
                    <p>Confidence: {p.confidence}</p>
                    <p>Evidence: {p.evidence}</p>
                    <p>Next step: {p.recommended_action}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
          <section className="space-y-4" aria-label="Recommendations">
            <h2 className="text-2xl font-semibold">Recommendations</h2>
            {recommendations.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      disabled={busy || !!confirmation}
                      checked={
                        group.length > 0 &&
                        group.every((r) => selected.includes(r.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? group.map((r) => r.id) : [],
                        )
                      }
                    />
                    {recommendations.length <= 50
                      ? `Select all ${recommendations.length} loaded`
                      : `Select first 50 of ${recommendations.length} loaded`}
                  </label>
                  <span>{selected.length} selected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Accept selected", "accepted"],
                    ["Dismiss selected", "dismissed"],
                    ["Reopen selected", "open"],
                  ].map(([label, status]) => (
                    <button
                      key={status}
                      className={button}
                      disabled={
                        busy ||
                        !!confirmation ||
                        selected.length === 0 ||
                        selected.length > 50
                      }
                      onClick={() => review(status)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-sm">
                  Choose up to 50 at a time. Accepting saves your decision; you
                  choose when to do the work.
                </p>
              </>
            )}
            {confirmation && (
              <div
                role="region"
                aria-label="Review selected changes"
                className="space-y-3 rounded-xl border border-primary p-4"
              >
                <h3 className="font-semibold">
                  {confirmation.status === "open"
                    ? "Reopen"
                    : confirmation.status === "accepted"
                      ? "Accept"
                      : "Dismiss"}{" "}
                  these {confirmation.titles.length} recommendations?
                </h3>
                <ul className="list-disc pl-5">
                  {confirmation.titles.map((title, i) => (
                    <li className="break-words" key={i}>
                      {title}
                    </li>
                  ))}
                </ul>
                <p>This saves your choices for these recommendations.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={applyBatch}
                  >
                    {confirmation.attempted
                      ? "Retry same selection"
                      : "Confirm changes"}
                  </button>
                  {!confirmation.attempted && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => {
                        setConfirmation(null);
                        operationRef.current = null;
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
            {recommendations.map((r) => (
              <article
                key={r.id}
                className="space-y-3 rounded-xl border p-4 break-words"
              >
                <label className="flex min-h-11 items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.title}`}
                    className="mt-1"
                    disabled={busy || !!confirmation}
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, r.id]
                          : current.filter((id) => id !== r.id),
                      )
                    }
                  />
                  <span className="font-semibold">{r.title}</span>
                </label>
                <p className="text-sm">
                  {r.campaign_title} · {r.status}
                </p>
                <p>{r.description}</p>
                <details>
                  <summary className="min-h-11 cursor-pointer">
                    Why this may help
                  </summary>
                  <div className="space-y-2">
                    <p>{r.reasoning}</p>
                    <p>Evidence: {r.evidence}</p>
                    <p>Confidence: {r.confidence}</p>
                    <p>Expected impact: {r.expected_impact}</p>
                    <p>Effort: {r.estimated_effort}</p>
                  </div>
                </details>
              </article>
            ))}
            {workspace?.recommendations_truncated && (
              <p>
                Showing your latest 100 recommendations. Selecting all applies
                only to the recommendations shown here.
              </p>
            )}
          </section>
          <p className="text-sm text-muted-foreground">
            Verified external funding opportunities and other specialists will
            be added as their integrations are completed.
          </p>
        </>
      )}
    </main>
  );
}
