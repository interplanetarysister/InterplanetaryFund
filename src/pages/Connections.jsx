import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { platforms } from "../lib/platforms";
import { Loading, Message } from "../components/UI";

export default function Connections({ user }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!db || !user?.id) {
      setRecords([]);
      return;
    }
    setRecords(null);
    db.from("ifund_connections").select("provider,status,verified_at")
      .eq("owner_id", user.id).then(({ data, error: loadError }) => {
        if (cancelled) return;
        setRecords(data || []);
        setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setRecords([]);
        setError(cause?.message || "Could not load connection status.");
      });
    return () => { cancelled = true; };
  }, [user?.id, revision]);

  const index = new Map((records || []).map((item) => [item.provider, item]));
  const verified = (records || []).filter((item) =>
    item.status === "connected" && Boolean(item.verified_at)).length;
  return (
    <main>
      <h1>Connections Center</h1>
      <p>These statuses come from your own provider connection records. A provider is only shown as connected after a successful, recorded verification.</p>
      {!user ? <p><Link to="/login">Sign in</Link> to see your own connections.</p> :
        <div className="actions">
          <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}
            disabled={!db}>Refresh connection statuses</button>
          <span role="status">{records === null ? "Loading…" : verified + " verified connections"}</span>
        </div>}
      <Message error>{error}</Message>
      {records === null ? <Loading /> : (
        <div className="cards">
          {platforms.map((platform) => {
            const connection = index.get(platform.id);
            const isVerified = connection?.status === "connected" && Boolean(connection.verified_at);
            const status = isVerified ? "Connected · verified"
              : connection?.status === "pending" ? "Awaiting verification"
              : connection?.status === "error" ? "Needs attention"
              : connection?.status === "connected" ? "Unverified"
              : "Not connected";
            return <div className="card" key={platform.id}>
              <h3>{platform.name}</h3>
              <span className="pill">{status}</span>
              {isVerified && <p><small>{"Verified " + new Date(connection.verified_at).toLocaleDateString()}</small></p>}
              {!isVerified && <p>Provider authorization and a live verification are required before publishing or sync can be enabled.</p>}
            </div>;
          })}
        </div>
      )}
      <section className="card">
        <h2>Connection security</h2>
        <p>Connections are not activated by this screen. Provider OAuth, ownership authorization and request-only external synchronization require the independent integration service.</p>
        <Link className="secondary" to="/profile">Account settings</Link>
      </section>
    </main>
  );
}
