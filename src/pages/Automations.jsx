import { useEffect, useState } from "react";

/** The same independent status screen works for browser and installed web app. */
export default function Automations() {
  const [state, setState] = useState({ loading: true, report: null });
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/automations/readiness", {
      signal: abort.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(async (result) => {
        if (!result.ok) throw new Error("unavailable");
        const payload = await result.json();
        if (payload?.state !== "not_connected" || payload?.execution_enabled !== false) {
          throw new Error("unverified");
        }
        setState({ loading: false, report: payload });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setState({ loading: false, report: null });
      });
    return () => abort.abort();
  }, []);
  return (
    <main>
      <h1>Agents and workflows</h1>
      <p>
        Migration status for the new Interplanetary Fund service. Listing an
        automation does not mean its connection or execution has been verified.
      </p>
      {state.loading ? (
        <p role="status">Checking independent automation services…</p>
      ) : !state.report ? (
        <p role="status">
          Automation status cannot be verified. Automated actions are not available.
        </p>
      ) : (
        <section aria-label="Automation migration status">
          <p role="status">Not connected — production execution is disabled.</p>
          <p>Source agents: {state.report.source_agents}</p>
          <p>Source workflows: {state.report.source_workflows}</p>
          <p>Source platform connectors: {state.report.source_connectors}</p>
          <p>
            Verified active agents: {state.report.verified_active_agents}.
            Verified active workflows: {state.report.verified_active_workflows}.
          </p>
          <p>
            Social publishing, AI generation, withdrawals and other external
            actions will remain unavailable until their connection and
            authorization checks pass.
          </p>
        </section>
      )}
    </main>
  );
}
