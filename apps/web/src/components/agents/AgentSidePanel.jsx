import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X, Send, ExternalLink } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";
import { askIFundAgent } from "@/lib/agentQuestions";
import { canAskAgentWithSavedPermission } from "@/lib/agentAdvisoryPermission.mjs";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";

const choices = Object.keys(AGENT_IDENTITIES);
/** A non-modal workspace companion: route changes must never reset a conversation. */
export default function AgentSidePanel({ agent, onSelect, onClose }) {
  const { user } = useAuthSession();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [availability, setAvailability] = useState({ loading: true, enabled: false, reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(null);
  const scroll = useRef(null);
  const previousOwner = useRef(user?.id || null);
  const identity = choices.includes(agent) ? agent : "nexus";

  useEffect(() => {
    if (previousOwner.current !== (user?.id || null)) {
      previousOwner.current = user?.id || null;
      active.current?.abort();
      setMessages([]);
      setQuestion("");
      setError("");
    }
  }, [user?.id]);
  useEffect(() => {
    if (!agent) active.current?.abort();
  }, [agent]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
  }, [messages, error, agent]);
  useEffect(() => {
    const controller = new AbortController();
    const owner = user?.id;
    setAvailability({ loading: true, enabled: false, reason: "" });
    if (!owner) {
      setAvailability({ loading: false, enabled: false, reason: "Sign in to ask an agent." });
      return () => controller.abort();
    }
    (async () => {
      try {
        const client = authClient();
        const [status, subscription, preferences, identityResponse] = await Promise.all([
          fetch("/api/agents/team/status", { signal: controller.signal, cache: "no-store" }),
          client.rpc("ifund_story_subscription"),
          client.from("ifund_ai_permission_preferences").select("owner_id,allow_ai_campaign_drafts,allow_future_internal_ai_assistance").eq("owner_id", owner).maybeSingle(),
          client.auth.getUser(),
        ]);
        const gateway = await status.json().catch(() => null);
        const verified = identityResponse.data?.user;
        const permitted = !preferences.error && canAskAgentWithSavedPermission({ user: verified, ownerId: owner, preferences: preferences.data });
        const subscribed = !subscription.error && subscription.data?.active === true && Number.isInteger(subscription.data.level) && subscription.data.level >= 1;
        if (controller.signal.aborted) return;
        setAvailability({
          loading: false, enabled: status.ok && gateway?.configured === true && subscribed && permitted && verified?.id === owner,
          reason: !status.ok || gateway?.configured !== true ? "Direct agent answers are unavailable on this deployment." :
            !subscribed ? "Direct answers require a verified AI membership." :
            !permitted ? "Enable private AI assistance in your permissions to ask an agent." : "",
        });
      } catch {
        if (!controller.signal.aborted) setAvailability({ loading: false, enabled: false, reason: "Agent access could not be verified." });
      }
    })();
    return () => controller.abort();
  }, [user?.id]);

  async function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!availability.enabled || busy || text.length < 8 || text.length > 2000 || !user?.id) return;
    setQuestion("");
    setError("");
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setMessages(items => [...items, { agent: identity, kind: "user", text }]);
    try {
      const response = await askIFundAgent(authClient(), { question: text, agent: identity, ownerId: user.id, signal: controller.signal });
      if (!controller.signal.aborted) setMessages(items => [...items, { agent: response.agent, kind: "answer", text: response.answer }]);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause?.message || "The agent could not answer.");
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  if (!agent) return null;
  return <aside className="ifund-agent-side-panel" aria-label="Agent conversation" aria-live="off">
    <header className="ifund-agent-panel-header">
      <div className="flex items-center gap-3 min-w-0"><AgentIdentityIcon identity={identity} size={42}/>
        <div><h2 className="font-bold tracking-wide">{AGENT_IDENTITIES[identity].name}</h2><p className="text-xs text-slate-400">{AGENT_IDENTITIES[identity].role}</p></div>
      </div>
      <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close agent panel"><X size={22}/></button>
    </header>
    <p className="px-4 pb-2 text-xs text-slate-400">Keep browsing IFund while this conversation stays open.</p>
    <div className="ifund-agent-panel-choices" aria-label="Switch agent">
      {choices.map(id => <button type="button" key={id} title={AGENT_IDENTITIES[id].name}
        aria-label={"Talk to " + AGENT_IDENTITIES[id].name} aria-pressed={identity === id}
        onClick={() => { active.current?.abort(); setBusy(false); onSelect(id); }}>
        <AgentIdentityIcon identity={id} size={35}/></button>)}
    </div>
    <div ref={scroll} className="ifund-agent-panel-messages" role="log" aria-label="Agent messages" aria-live="polite">
      {messages.length === 0 && <div className="ifund-agent-panel-welcome">
        {AGENT_IDENTITIES[identity].name} can help with {AGENT_IDENTITIES[identity].role.toLowerCase()}. Ask a question below.
      </div>}
      {messages.map((message, index) => <div key={index} className={"ifund-agent-message " + message.kind}>
        {message.kind === "answer" && <strong className="block mb-1">{AGENT_IDENTITIES[message.agent]?.name || "Agent"}</strong>}
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
      </div>)}
      {busy && <p role="status" className="text-sm text-slate-400">Checking your question…</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </div>
    <div className="ifund-agent-panel-compose">
      {!availability.enabled && <p role="status" className="mb-2 text-xs text-slate-300">{availability.loading ? "Checking agent access…" : availability.reason}{" "}
        {!user ? <Link className="underline" to="/login?returnTo=%2Fagents">Sign in</Link> :
          <Link className="underline" to="/subscriptions">Agent plans and permissions</Link>}
      </p>}
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="ifund-side-agent-question" className="sr-only">Ask the selected agent</label>
        <textarea id="ifund-side-agent-question" rows={2} maxLength={2000}
          value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask your agent…"
          className="min-w-0 flex-1 resize-none rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-white placeholder:text-slate-400"/>
        <button type="submit" aria-label="Send agent question" disabled={!availability.enabled || busy || question.trim().length < 8}
          className="self-end rounded-xl bg-cyan-600 p-3 text-white disabled:opacity-40"><Send size={18}/></button>
      </form>
      <Link to={"/agents?agent=" + encodeURIComponent(identity)} className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300">Full agent workspace <ExternalLink size={12}/></Link>
      <p className="mt-1 text-[11px] text-slate-400">Answers are advisory. External actions require separate approval.</p>
    </div>
  </aside>;
}
