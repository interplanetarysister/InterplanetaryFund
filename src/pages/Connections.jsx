import { useEffect, useState } from "react";
import { db } from "../lib/supabase";
import { platforms } from "../lib/platforms";

export default function Connections({ user }) {
  const [state, setState] = useState({ loading: true, rows: [], error: "" });
  useEffect(() => {
    let active = true;
    if (!db || !user) {
      setState({
        loading: false,
        rows: [],
        error: "Sign in to review verified platform connections.",
      });
      return;
    }
    db.from("ifund_connections")
      .select("provider,status,verified_at")
      .eq("owner_id", user.id)
      .then(({ data, error }) => {
        if (active)
          setState({
            loading: false,
            rows: data || [],
            error: error ? "Connection verification is unavailable." : "",
          });
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            rows: [],
            error: "Unable to check provider connection status.",
          });
      });
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <main className="stack">
      <h1>Connections</h1>
      <p>
        Manage your social and fundraising platforms from one place. A service
        is shown as connected only after its verified provider handshake is
        recorded.
      </p>
      {state.loading ? (
        <p role="status">Checking connections…</p>
      ) : state.error ? (
        <p role="alert">{state.error}</p>
      ) : null}
      <div className="cards">
        {platforms.map((p) => {
          const connection = state.rows.find((row) => row.provider === p.id);
          const connected =
            !state.error &&
            connection?.status === "connected" &&
            Boolean(connection.verified_at);
          return (
            <section className="card" key={p.id}>
              <h2>{p.name}</h2>
              <span className="pill">
                {state.loading
                  ? "Checking"
                  : state.error
                    ? "Unavailable"
                    : connected
                      ? "Verified connection"
                      : "Not verified"}
              </span>
              <p>
                {connected
                  ? "The connection is recorded as verified. Publishing, synchronization and payments still require separate live service checks."
                  : "A secure independent provider authorization is required before this platform can be used."}
              </p>
            </section>
          );
        })}
      </div>
      <p className="ifund-route-notice">
        No authorization buttons are offered until a secure OAuth or API
        handshake and post-connect verification are available. No credentials
        are collected on this page.
      </p>
    </main>
  );
}
