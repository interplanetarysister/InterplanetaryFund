import { useEffect, useState } from "react";
import { db } from "../lib/supabase";

/** The same independent status screen works for browser and installed web app. */
export default function Automations({ user }) {
  const [integration, setIntegration] = useState({ loading: false, data: null, error: "" });
  const isAdmin = user?.app_metadata?.role === "admin" || user?.app_metadata?.role === "super_admin";
  async function checkIntegrations() {
    setIntegration({ loading: true, data: null, error: "" });
    try {
      const session = await db?.auth?.getSession();
      const token = session?.data?.session?.access_token;
      if (!token) throw new Error("not signed in");
      const result = await fetch("/api/admin/integrations/health", {
        method: "GET", headers: { Authorization: "Bearer " + token, Accept: "application/json" },
        cache: "no-store",
      });
      if (!result.ok) throw new Error("unavailable");
      const data = await result.json();
      if (data?.source !== "independent_admin_read_only" || data?.active_financial_operations !== false)
        throw new Error("invalid response");
      setIntegration({ loading: false, data, error: "" });
    } catch {
      setIntegration({ loading: false, data: null,
        error: "Independent integration verification is unavailable. No connection has been confirmed." });
    }
  }
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
        if (
          payload?.state !== "not_connected" ||
          payload?.execution_enabled !== false
        ) {
          throw new Error("unverified");
        }
        setState({ loading: false, report: payload });
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ loading: false, report: null });
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
      {isAdmin && (
        <section className="card" aria-label="Administrator integration verification">
          <h2>Provider verification</h2>
          <p>Check independent connection evidence. A configured service is not necessarily connected.</p>
          <button type="button" disabled={integration.loading} onClick={checkIntegrations}>
            {integration.loading ? "Checking providers…" : "Check integrations"}
          </button>
          {integration.error && <p role="status">{integration.error}</p>}
          {integration.data && <div role="status">
            <p>Independent financial and automation execution remain inactive.</p>
            <ul>{integration.data.provider_evidence?.map((entry) => (
              <li key={entry.provider}>{entry.provider}: {entry.status}</li>
            ))}</ul>
          </div>}
        </section>
      )}
      {state.loading ? (
        <p role="status">Checking independent automation services…</p>
      ) : !state.report ? (
        <p role="status">
          Automation status cannot be verified. Automated actions are not
          available.
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
