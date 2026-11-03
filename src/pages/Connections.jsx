import { useState } from "react";
import { Link } from "react-router-dom";
import { PlugZap, ShieldCheck, Search } from "lucide-react";
import { platforms } from "../lib/platforms";

export default function Connections() {
  const [query, setQuery] = useState("");
  const visible = platforms.filter((platform) =>
    platform.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <main className="ifund-connections">
      <section className="ifund-connections-hero">
        <PlugZap size={30} aria-hidden="true" />
        <p className="eyebrow">YOUR CONNECTED UNIVERSE</p>
        <h1>Mission Links</h1>
        <p>Explore the accounts you can connect to your fundraising mission.</p>
      </section>
      <section className="ifund-connections-guidance">
        <ShieldCheck size={24} aria-hidden="true" />
        <div>
          <strong>Your accounts stay in your control</strong>
          <p>Connections are not active yet. No automatic posting or financial synchronization occurs in this preview.</p>
        </div>
      </section>
      <label className="ifund-connections-search">
        <Search size={20} aria-hidden="true" />
        <span className="sr-only">Find a platform</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a platform..." />
      </label>
      <h2>Available platforms</h2>
      <div className="ifund-connections-grid">
        {visible.map((platform) => (
          <article className="card ifund-connection-card" key={platform.id}>
            <span className="ifund-connection-avatar" aria-hidden="true"><PlugZap size={22} /></span>
            <div><h3>{platform.name}</h3><p>Not connected</p></div>
            <span className="ifund-connection-status">Setup pending</span>
          </article>
        ))}
      </div>
      {visible.length === 0 && <p>No matching platforms. Try another search.</p>}
      <p className="ifund-agent-disclaimer">Secure provider sign-in and live verification must be completed before connections can be activated.</p>
      <Link className="ifund-back-link" to="/dashboard">Return to Dashboard</Link>
    </main>
  );
}
