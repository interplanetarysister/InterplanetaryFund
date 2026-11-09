import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { connectionStatusLabel } from "@/lib/connectionPresentation";
import { requestConnectionApi } from "@/lib/connectionSession";
const button = "min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50";
const input = "mt-1 min-h-11 w-full rounded-lg border bg-background p-3";
const activeRequest = (r) =>
  [
    "requested",
    "assigned",
    "in_progress",
    "waiting_user",
    "waiting_external",
    "needs_review",
  ].includes(r.status);
export default function Connections() {
  const [search] = useSearchParams();
  const requestedProvider = search.get("connect") || "";
  const lastRequestedProvider = useRef(requestedProvider);
  const [workspace, setWorkspace] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState(""),
    [provider, setProvider] = useState(search.get("connect") || ""),
    [campaign, setCampaign] = useState(""),
    [action, setAction] = useState("connect"),
    [connection, setConnection] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [selected, setSelected] = useState([]),
    [review, setReview] = useState(null),
    [retry, setRetry] = useState(false);
  const alive = useRef(true),
    working = useRef(false),
    owner = useRef(null),
    pending = useRef(null),
    epoch = useRef(0);
  const providers = workspace?.providers || [],
    permissions = workspace?.permissions || [],
    requests = workspace?.requests || [],
    connections = workspace?.connections || [];
  const chosen = providers.find((p) => p.id === provider),
    currentPermission = permissions.find(
      (p) =>
        p.provider === provider &&
        p.campaign_id === (campaign || null) &&
        p.status === "active" &&
        p.policy_version === workspace?.policy_version,
    );
  const selectedRows = selected
    .map((key) => {
      const [kind, id] = key.split(":");
      const row = (kind === "revoke" ? permissions : requests).find(
        (r) => r.id === id,
      );
      return row ? { ...row, kind } : null;
    })
    .filter(Boolean);
  const locked = busy || retry || !!review;
  async function api(path, body) {
    if (!alive.current) throw Error("This connection page is no longer active.");
    const { result, ownerId } = await requestConnectionApi({
      client: authClient(),
      path,
      body,
      ownerId: owner.current,
    });
    if (!alive.current) throw Error("This connection page is no longer active.");
    owner.current = ownerId;
    return result;
  }
  async function load() {
    const generation = ++epoch.current;
    const result = await api("workspace");
    if (alive.current && generation === epoch.current) setWorkspace(result);
    return result;
  }
  useEffect(() => {
    alive.current = true;
    load()
      .catch((e) => {
        if (alive.current) setError(e.message);
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, []);
  useEffect(() => {
    if (requestedProvider === lastRequestedProvider.current || busy || retry)
      return;
    lastRequestedProvider.current = requestedProvider;
    setProvider(requestedProvider);
    setCampaign("");
    setAction("connect");
    setConfirmed(false);
    setConnection("");
    setSelected([]);
    setReview(null);
    setNotice("");
    setError("");
  }, [requestedProvider, busy, retry]);
  function resetScope() {
    setConfirmed(false);
    setConnection("");
    setNotice("");
    setError("");
  }
  async function mutate(path, body) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    pending.current = pending.current || { path, body };
    const exact = pending.current;
    try {
      const result = await api(exact.path, exact.body);
      if (!alive.current) return;
      pending.current = null;
      setRetry(false);
      setSelected([]);
      setReview(null);
      setConfirmed(false);
      setNotice(
        result.message ||
          result.request?.message ||
          (result.permission
            ? "IFund help permission saved for this provider and campaign."
            : "Your request is saved."),
      );
      await load();
    } catch (e) {
      if (alive.current) {
        setError(e.message);
        setRetry((!e.status || e.status >= 500) && !!pending.current);
        if (e.status && e.status < 500) pending.current = null;
      }
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function reload() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    try {
      await load();
      if (alive.current) {
        pending.current = null;
        setRetry(false);
        setSelected([]);
        setReview(null);
        setConfirmed(false);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function toggle(kind, id, checked) {
    setReview(null);
    setSelected((s) =>
      checked
        ? [...s, kind + ":" + id]
        : s.filter((k) => k !== kind + ":" + id),
    );
  }
  function prepare(kind) {
    const rows = selectedRows.filter((r) => r.kind === kind);
    if (!rows.length || rows.length > 50) return;
    setReview({
      kind,
      items: rows.map(({ id, revision }) => ({ id, revision })),
      labels: rows.map(
        (r) => providers.find((p) => p.id === r.provider)?.name || r.provider,
      ),
    });
  }
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Connections</h1>
        <button className={button} disabled={busy} onClick={reload}>
          Reload connections
        </button>
      </div>
      <p className="my-4">
        Get help connecting your campaign tools and accounts. IFund checks
        provider access before using a connection. You stay in control of
        account approval and sensitive changes.
      </p>
      <nav
        aria-label="Agent navigation"
        className="mb-5 flex flex-wrap gap-4 text-sm"
      >
        <Link to="/agents">Story</Link>
        <Link to="/agents/strategy">Strategy</Link>
        <Link to="/agents/growth">Growth</Link>
        <Link to="/communications">Communications</Link>
        <Link to="/agents/connections">Managed Connections</Link>
      </nav>
      {loading && <p>Loading connections…</p>}
      {error && (
        <p role="alert" className="my-3 break-words text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-3 break-words">
          {notice}
        </p>
      )}
      {retry && (
        <div className="my-3 rounded-xl border p-4">
          <p>
            The response was interrupted. Retry the same request to check its
            saved receipt.
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() => mutate(pending.current.path, pending.current.body)}
          >
            Retry same request
          </button>
        </div>
      )}
      {workspace && (
        <>
          <section
            aria-label="Choose a connection"
            className="my-5 rounded-xl border p-4"
          >
            <h2 className="text-xl font-semibold">Choose a provider</h2>
            <label className="mt-3 block">
              Find a provider
              <input
                className={input}
                value={filter}
                disabled={locked}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {providers
                .filter((p) =>
                  (p.name + " " + p.kind)
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    className={
                      button +
                      " min-w-0 text-left " +
                      (provider === p.id ? "border-primary bg-primary/10" : "")
                    }
                    disabled={locked}
                    aria-pressed={provider === p.id}
                    onClick={() => {
                      setProvider(p.id);
                      resetScope();
                    }}
                  >
                    {p.logo && (
                      <img
                        src={p.logo}
                        alt=""
                        className="mb-2 h-8 w-8 object-contain"
                        loading="lazy"
                      />
                    )}
                    <span className="break-words">{p.name}</span>
                  </button>
                ))}
            </div>
            {chosen && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">
                  Help with {chosen.name}
                </h3>
                <label className="block">
                  Campaign scope
                  <select
                    className={input}
                    aria-label="Campaign scope"
                    value={campaign}
                    disabled={locked}
                    onChange={(e) => {
                      setCampaign(e.target.value);
                      resetScope();
                    }}
                  >
                    <option value="">My account only</option>
                    {workspace.campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  IFund is still setting up this connection. You don't need to
                  change anything on your account. A saved request does not
                  create an account or connect a provider.
                </p>
                {!workspace.managed_available ? (
                  <p>
                    Managed connection help requires Outreach, Nonprofit or a
                    higher eligible plan. You can still review saved records,
                    cancel requests and revoke IFund permission below.
                  </p>
                ) : (
                  <>
                    {currentPermission ? (
                      <p>
                        IFund help is allowed for this scope until{" "}
                        {new Date(
                          currentPermission.expires_at,
                        ).toLocaleDateString(undefined, {
                          timeZone: "America/Los_Angeles",
                        })}
                        .
                      </p>
                    ) : (
                      <div className="space-y-3 rounded-lg border p-3">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-5 w-5 shrink-0"
                            checked={confirmed}
                            disabled={locked}
                            onChange={(e) => setConfirmed(e.target.checked)}
                          />
                          <span>
                            Allow IFund to help connect, create, repair or
                            reauthorize my {chosen.name} account for this scope
                            for 30 days. This does not authorize publishing,
                            payments, accepting provider terms or bypassing
                            login. I can revoke this permission.
                          </span>
                        </label>
                        <button
                          className={button}
                          disabled={locked || !confirmed}
                          onClick={() =>
                            mutate("grant-help", {
                              operation_id: crypto.randomUUID(),
                              provider,
                              campaign_id: campaign || null,
                              policy_version: workspace.policy_version,
                              confirmed: true,
                            })
                          }
                        >
                          Allow IFund help
                        </button>
                      </div>
                    )}
                    <label className="block">
                      Action
                      <select
                        className={input}
                        disabled={locked}
                        aria-label="Action"
                        value={action}
                        onChange={(e) => {
                          setAction(e.target.value);
                          setConnection("");
                        }}
                      >
                        <option value="connect">Connect my account</option>
                        <option value="create_account">
                          Help create an account
                        </option>
                        <option value="repair">Repair a connection</option>
                        <option value="reauthorize">
                          Renew provider permission
                        </option>
                      </select>
                    </label>
                    {["repair", "reauthorize"].includes(action) && (
                      <label className="block">
                        Connection to review
                        <select
                          className={input}
                          disabled={locked}
                          aria-label="Connection to review"
                          value={connection}
                          onChange={(e) => setConnection(e.target.value)}
                        >
                          <option value="">Choose your connection</option>
                          {connections
                            .filter((c) => c.provider === provider)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {chosen.name} — {c.status.replaceAll("_", " ")}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <button
                      className={button}
                      disabled={
                        locked ||
                        !currentPermission ||
                        (["repair", "reauthorize"].includes(action) &&
                          !connection)
                      }
                      onClick={() =>
                        mutate("requests", {
                          operation_id: crypto.randomUUID(),
                          provider,
                          campaign_id: campaign || null,
                          action,
                          connection_id: connection || null,
                        })
                      }
                    >
                      Save help request
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
          <section aria-label="Saved connection records" className="my-6">
            <h2 className="text-xl font-semibold">Your connection records</h2>
            <p className="my-2">
              Saved records need a current provider check. They do not authorize
              publishing or money movement.
            </p>
            {!connections.length && <p>No connections recorded.</p>}
            {connections.map((c) => (
              <article key={c.id} className="my-2 rounded-xl border p-3">
                <h3>
                  {providers.find((p) => p.id === c.provider)?.name ||
                    c.provider}
                </h3>
                <p>{connectionStatusLabel(c)}</p>
              </article>
            ))}
          </section>
          <section aria-label="IFund help permissions" className="my-6">
            <h2 className="text-xl font-semibold">IFund help permissions</h2>
            <p className="my-2">
              Revoking stops IFund work under that permission. Remove existing
              provider access in the provider's own settings if needed.
            </p>
            {!permissions.length && <p>No help permission saved.</p>}
            {permissions.map((p) => (
              <article
                key={p.id}
                className="my-2 flex min-w-0 items-start gap-3 rounded-xl border p-3"
              >
                {p.status !== "revoked" && (
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    aria-label={"Select permission " + p.provider + " " + p.id}
                    disabled={locked}
                    checked={selected.includes("revoke:" + p.id)}
                    onChange={(e) => toggle("revoke", p.id, e.target.checked)}
                  />
                )}
                <div className="min-w-0 break-words">
                  <h3>
                    {providers.find((x) => x.id === p.provider)?.name ||
                      p.provider}
                  </h3>
                  <p>
                    {workspace.campaigns.find((c) => c.id === p.campaign_id)
                      ?.title ||
                      (p.campaign_id
                        ? "Campaign unavailable"
                        : "My account only")}{" "}
                    · {p.status}
                  </p>
                </div>
              </article>
            ))}
            <button
              className={button}
              disabled={
                locked ||
                !selectedRows.some((r) => r.kind === "revoke") ||
                selectedRows.filter((r) => r.kind === "revoke").length > 50
              }
              onClick={() => prepare("revoke")}
            >
              Review selected revocations
            </button>
          </section>
          <section aria-label="Connection help requests" className="my-6">
            <h2 className="text-xl font-semibold">Your help requests</h2>
            {!requests.length && <p>No help requests saved.</p>}
            {requests.map((r) => (
              <article
                key={r.id}
                className="my-2 flex min-w-0 items-start gap-3 rounded-xl border p-3"
              >
                {activeRequest(r) && (
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    aria-label={"Select request " + r.provider + " " + r.id}
                    disabled={locked}
                    checked={selected.includes("cancel:" + r.id)}
                    onChange={(e) => toggle("cancel", r.id, e.target.checked)}
                  />
                )}
                <div className="min-w-0 break-words">
                  <h3>
                    {providers.find((p) => p.id === r.provider)?.name ||
                      r.provider}{" "}
                    · {r.action.replaceAll("_", " ")}
                  </h3>
                  <p>{r.status.replaceAll("_", " ")}</p>
                  <p>{r.message}</p>
                </div>
              </article>
            ))}
            <button
              className={button}
              disabled={
                locked ||
                !selectedRows.some((r) => r.kind === "cancel") ||
                selectedRows.filter((r) => r.kind === "cancel").length > 50
              }
              onClick={() => prepare("cancel")}
            >
              Review selected cancellations
            </button>
          </section>
          {review && (
            <section
              aria-label="Review selected connection changes"
              className="my-5 rounded-xl border border-primary p-4"
            >
              <h2 className="text-xl font-semibold">
                {review.kind === "revoke"
                  ? "Revoke IFund help permission"
                  : "Cancel help requests"}
              </h2>
              <p>
                {review.items.length} selected: {review.labels.join(", ")}
              </p>
              <p>
                This does not delete accounts or revoke access at the provider.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    mutate("change-selected", {
                      operation_id: crypto.randomUUID(),
                      kind: review.kind,
                      items: review.items,
                    })
                  }
                >
                  Confirm{" "}
                  {review.kind === "revoke" ? "revocation" : "cancellation"}
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => setReview(null)}
                >
                  Back to connections
                </button>
              </div>
            </section>
          )}
          <p className="text-sm">
            Showing up to 100 saved records in each list. Bulk changes apply to
            at most 50 explicitly selected records.
          </p>
        </>
      )}
    </main>
  );
}
