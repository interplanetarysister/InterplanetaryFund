import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/**
 * Read-only workflow registry, authorized by the database RPC itself.
 * A configured/enabled row is not proof of a successful runtime execution.
 * Do not offer dispatch, retry, cron edits, or billing side effects here.
 */
export default function WorkflowRegistry() {
  const [state, setState] = useState({ phase: "loading", rows: [], error: "" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ phase: "loading", rows: [], error: "" });
    (async () => {
      const client = authClient();
      const before = await client.auth.getUser();
      const id = before?.data?.user?.id;
      if (before.error || !id) throw Error("An administrator session is required.");
      const { data, error } = await client.rpc("ifund_admin_workflow_registry");
      if (error || !Array.isArray(data)) throw Error("The protected workflow registry could not be verified.");
      if (data.some(item =>
        typeof item?.source_id !== "string" || typeof item?.name !== "string" ||
        typeof item?.execution_enabled !== "boolean"))
        throw Error("Workflow records could not be verified.");
      const after = await client.auth.getUser();
      if (after.error || after?.data?.user?.id !== id)
        throw Error("Your session changed. Refresh the workflow registry.");
      if (alive) setState({ phase: "ready", rows: data, error: "" });
    })().catch(cause => {
      if (alive) setState({ phase: "error", rows: [], error: cause?.message || "Workflow registry unavailable." });
    });
    return () => { alive = false; };
  }, [attempt]);

  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Verified workflow registry">
    <header className="space-y-2">
      <h2 className="text-xl font-semibold">Workflow registry</h2>
      <p className="text-sm text-muted-foreground">Verified administrator view of registered workflows and migration state. An enabled configuration does not establish that a job ran or succeeded.</p>
    </header>
    {state.phase === "loading" && <p role="status">Reading your authorized workflow registry…</p>}
    {state.phase === "error" && <div role="alert" className="space-y-3">
      <p>{state.error}</p>
      <button type="button" onClick={() => setAttempt(n => n + 1)} className="min-h-11 rounded-xl border px-4">Retry authorized read</button>
    </div>}
    {state.phase === "ready" && (state.rows.length === 0
      ? <p className="text-sm text-muted-foreground">No registered workflows were returned for this administrator account.</p>
      : <div className="max-h-96 overflow-auto" role="region" aria-label="Workflow details" tabIndex={0}>
        <table className="min-w-[600px] w-full text-left text-sm">
          <thead><tr className="border-b border-border">
            <th scope="col" className="p-3">Workflow</th><th scope="col" className="p-3">Trigger</th>
            <th scope="col" className="p-3">Migration</th><th scope="col" className="p-3">Configuration</th>
          </tr></thead>
          <tbody>{state.rows.map((item, index) => <tr key={item.source_id + index} className="border-b border-border/60">
            <th scope="row" className="p-3 font-medium">{item.name}</th>
            <td className="p-3">{item.trigger_kind || "Not specified"}</td>
            <td className="p-3">{item.migration_status || "Unverified"}</td>
            <td className="p-3">{item.execution_enabled ? "Configured as enabled" : "Disabled"}</td>
          </tr>)}</tbody>
        </table>
      </div>)}
  </section>;
}
