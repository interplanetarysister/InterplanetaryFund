import { useState } from "react";
import { Link } from "react-router-dom";
import { AGENT_ROSTER, AGENT_RUNTIME } from "../lib/agentRoster";

export default function Agents({ user }) {
  const [selected, setSelected] = useState("chief_of_staff");
  const current = AGENT_ROSTER.find((agent) => agent.id === selected) || AGENT_ROSTER[0];
  if (!user) return <main><h1>Your AI team</h1>
    <p>Sign in to access your private workspace.</p>
    <Link className="primary" to="/login?returnTo=%2Fagents">Sign in</Link></main>;
  return <main className="agent-team">
    <h1>Your AI team</h1>
    <p>Your IFund specialists share one workspace, coordinated by the Chief of Staff.</p>
    <section className="card">
      <h2>AI service status</h2>
      <p role="status">Independent agent conversations are not connected yet.</p>
      <p>The original roles are preserved below, but no agent can read your data, send messages, or run automation until its independent runtime and permissions are verified.</p>
      <Link className="secondary" to="/mission">Open campaign Mission Control</Link>
    </section>
    <div className="agent-layout">
      <section>
        <h2>Specialists</h2>
        <div className="agent-list" role="group" aria-label="Choose specialist">
          {AGENT_ROSTER.map((agent) => <button key={agent.id}
            type="button" aria-pressed={selected === agent.id}
            onClick={() => setSelected(agent.id)}
            className={selected === agent.id ? "primary" : "secondary"}>
            <strong>{agent.name}</strong>
          </button>)}
        </div>
      </section>
      <section className="card agent-conversation" aria-label="One conversation workspace">
        <small>Specialist selected</small>
        <h2>{current.name}</h2>
        <p>{current.description}</p>
        <p className="pill">Not connected</p>
        <div className="agent-chat-disabled">
          <label htmlFor="agent-prompt">Conversation
            <textarea id="agent-prompt" rows={4} disabled
              placeholder="Private conversations become available after verified agent setup." /></label>
          <button type="button" disabled>Send to specialist</button>
        </div>
        <p>While the independent agent service is inactive, you can still review campaigns and get field-based suggestions in Mission Control.</p>
        <Link to="/mission">Campaign recommendations</Link>
      </section>
    </div>
    <small>{AGENT_RUNTIME.reason}</small>
  </main>;
}
