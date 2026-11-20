import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X, Send, ExternalLink, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { authClient } from "@/api/auth";
import { askIFundAgent } from "@/lib/agentQuestions";
import { canAskAgentWithSavedPermission } from "@/lib/agentAdvisoryPermission.mjs";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";
import { makeRecognition, speakAgent, stopSpeaking, canSpeak } from "@/lib/agentSpeech.mjs";
import AgentConsultationTrail from "@/components/agents/AgentConsultationTrail";

const choices = Object.keys(AGENT_IDENTITIES);
/** A non-modal workspace companion: route changes must never reset a conversation. */
export default function AgentSidePanel({ agent, onSelect, onClose }) {
  const { user } = useAuthSession();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [availability, setAvailability] = useState({ loading: true, enabled: false, reason: "" });
  const [consentRevision, setConsentRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [compact, setCompact] = useState(false);
  const speechRef = useRef(null);
  const dictationBase = useRef("");
  const speechToken = useRef(0);
  const active = useRef(null);
  const scroll = useRef(null);
  const panel = useRef(null);
  const previousOwner = useRef(user?.id || null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const identity = choices.includes(agent) ? agent : "nexus";

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!agent || !compact || !panel.current) return;
    const previousFocus = document.activeElement;
    const node = panel.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.focus({ preventScroll: true });
    const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...node.querySelectorAll(selector)].filter(element => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
    };
  }, [agent, compact]);
  function stopListening() {
    speechToken.current += 1;
    const current = speechRef.current;
    speechRef.current = null;
    if (current) { current.onend = null; current.onerror = null; current.onresult = null; current.abort(); }
    setListening(false);
  }
  function stopAudio() {
    stopSpeaking();
    setSpeaking(false);
  }
  function toggleDictation() {
    if (listening) { stopListening(); return; }
    if (!availability.enabled || busy || !user?.id) return;
    const token = ++speechToken.current;
    dictationBase.current = question.trim();
    setVoiceError("");
    stopAudio();
    const recognition = makeRecognition({
      onText: ({ final, interim }) => {
        if (speechToken.current !== token) return;
        const combined = [dictationBase.current, final || interim].filter(Boolean).join(" ").slice(0, 2000);
        setQuestion(combined);
        if (final) dictationBase.current = combined;
      },
      onError: message => { if (speechToken.current === token) { setVoiceError(message); setListening(false); } },
      onEnd: () => { if (speechToken.current === token) { speechRef.current = null; setListening(false); } }
    });
    if (!recognition) { setVoiceError("Speech recognition is unsupported in this browser. You can type instead."); return; }
    speechRef.current = recognition;
    try { recognition.start(); setListening(true); }
    catch { speechRef.current = null; setListening(false); setVoiceError("Microphone access could not start. You can type instead."); }
  }

  useEffect(() => {
    if (previousOwner.current !== (user?.id || null)) {
      previousOwner.current = user?.id || null;
      active.current?.abort();
      stopListening();
      stopAudio();
      setVoiceEnabled(false);
      setMessages([]);
      setQuestion("");
      setError("");
    }
  }, [user?.id]);
  useEffect(() => {
    if (!agent) { active.current?.abort(); stopListening(); stopAudio(); }
  }, [agent]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
  }, [messages, error, agent]);
  useEffect(() => {
    const refresh = event => {
      if (event.detail?.ownerId !== user?.id) return;
      active.current?.abort();
      stopListening();
      stopAudio();
      setAvailability({loading:true,enabled:false,reason:""});
      setConsentRevision(value => value + 1);
    };
    window.addEventListener("ifund-ai-consent-changed",refresh);
    return () => window.removeEventListener("ifund-ai-consent-changed",refresh);
  }, [user?.id]);
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
          client.from("ifund_ai_permission_preferences").select("owner_id,allow_ai_campaign_drafts,allow_ai_outreach_drafts,allow_future_internal_ai_assistance").eq("owner_id", owner).maybeSingle(),
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
  }, [user?.id, consentRevision]);

  useEffect(() => () => { speechRef.current?.abort(); stopSpeaking(); }, []);
  async function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!availability.enabled || busy || text.length < 8 || text.length > 2000 || !user?.id) return;
    stopListening();
    stopAudio();
    setQuestion("");
    setError("");
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    setBusy(true);
    setMessages(items => [...items, { agent: identity, kind: "user", text }]);
    try {
      const response = await askIFundAgent(authClient(), { question: text, agent: identity, ownerId: user.id, signal: controller.signal });
      if (!controller.signal.aborted) {
        setMessages(items => [...items, { agent: response.agent, kind: "answer", text: response.answer, consultations:response.consultations }]);
        if (voiceEnabled && speakAgent(response.answer, response.agent, {onEnd: () => setSpeaking(false)})) setSpeaking(true);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause?.message || "The agent could not answer.");
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }

  if (!agent) return null;
  return <aside ref={panel} className="ifund-agent-side-panel" aria-label="Agent advisory panel" aria-live="off"
    role={compact ? "dialog" : undefined} aria-modal={compact ? "true" : undefined} tabIndex={compact ? -1 : undefined}>
    <header className="ifund-agent-panel-header">
      <div className="flex items-center gap-3 min-w-0"><AgentIdentityIcon identity={identity} size={42}/>
        <div><h2 className="font-bold tracking-wide">{AGENT_IDENTITIES[identity].name}</h2><p className="text-sm text-slate-300">{AGENT_IDENTITIES[identity].role}</p></div>
      </div>
      <button type="button" onClick={() => { stopListening(); stopAudio(); onClose(); }} className="ifund-agent-panel-close inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Close agent panel"><X size={22}/></button>
    </header>
    <p className="px-4 pb-2 text-sm text-slate-300">Keep browsing iFund while this advisory panel stays open.</p>
    <div className="ifund-agent-panel-choices" aria-label="Switch agent">
      {choices.map(id => <button type="button" key={id} title={AGENT_IDENTITIES[id].name}
        aria-label={"Ask " + AGENT_IDENTITIES[id].name} aria-pressed={identity === id}
        onClick={() => { active.current?.abort(); stopListening(); stopAudio(); setBusy(false); onSelect(id); }}>
        <AgentIdentityIcon identity={id} size={35}/><span>{AGENT_IDENTITIES[id].name}</span></button>)}
    </div>
    <div ref={scroll} className="ifund-agent-panel-messages" role="log" aria-label="Agent messages" aria-live="polite">
      {messages.length === 0 && <div className="ifund-agent-panel-welcome">
        {AGENT_IDENTITIES[identity].name} can help with {AGENT_IDENTITIES[identity].role.toLowerCase()}. Ask a question below.
      </div>}
      {messages.map((message, index) => <div key={index} className={"ifund-agent-message " + message.kind}>
        {message.kind === "answer" && <div className="mb-1 flex min-w-0 items-center gap-2">
          <AgentIdentityIcon identity={message.agent} size={24}/>
          <strong className="min-w-0 break-words">{AGENT_IDENTITIES[message.agent]?.name || "Agent"}</strong>
        </div>}
        {message.kind==="answer" && <AgentConsultationTrail consultations={message.consultations}/>}
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
      </div>)}
      {busy && <p role="status" className="text-sm text-slate-400">Checking your question…</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {voiceError && <p role="alert" className="text-sm text-amber-300">{voiceError}</p>}
    </div>
    <div className="ifund-agent-panel-compose">
      <nav aria-label="Quick site navigation" className="mb-3 flex flex-wrap gap-2 text-xs">
        <Link to="/help" className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-3 text-cyan-200">Site help</Link>
        <Link to="/create?manual=1" className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-3 text-cyan-200">Create a campaign</Link>
        <Link to="/discover" className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-3 text-cyan-200">Discover</Link>
        {user && <Link to="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-3 text-cyan-200">Dashboard</Link>}
      </nav>
      {!availability.enabled && <p role="status" className="mb-2 text-sm text-slate-200">{availability.loading ? "Checking agent access…" : availability.reason}{" "}
        {!user ? <Link className="underline" to="/login?returnTo=%2Fagents">Sign in</Link> :
          <Link className="underline" to="/subscriptions">Agent plans and permissions</Link>}
      </p>}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" aria-label={listening ? "Stop dictation" : "Dictate a message"} aria-pressed={listening}
          disabled={!availability.enabled || busy} onClick={toggleDictation}
          className="ifund-agent-panel-tool inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-600 px-3 py-2 text-sm text-white disabled:opacity-40">
          {listening ? <MicOff size={16}/> : <Mic size={16}/>}
          {listening ? "Stop listening" : "Speak"}
        </button>
        <button type="button" aria-label={voiceEnabled ? "Turn off spoken answers" : "Turn on spoken answers"}
          aria-pressed={voiceEnabled} disabled={!canSpeak()}
          onClick={() => { if (voiceEnabled) stopAudio(); setVoiceEnabled(value => !value); }}
          className="ifund-agent-panel-tool inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-600 px-3 py-2 text-sm text-white disabled:opacity-40">
          {voiceEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>}
          {voiceEnabled ? "Voice on" : "Voice off"}
        </button>
        {speaking && <button type="button" onClick={stopAudio} className="ifund-agent-panel-tool min-h-11 rounded-lg border border-slate-600 px-3 py-2 text-sm text-white">Stop audio</button>}
        {listening && <span role="status" className="text-xs text-cyan-300">Listening… review before sending</span>}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="ifund-side-agent-question" className="sr-only">Ask the selected agent</label>
        <textarea id="ifund-side-agent-question" rows={2} maxLength={2000}
          value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask your agent…"
          className="min-w-0 flex-1 resize-none rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-white placeholder:text-slate-400"/>
        <button type="submit" aria-label="Send agent question" disabled={!availability.enabled || busy || question.trim().length < 8}
          className="ifund-agent-panel-send inline-flex min-h-11 min-w-11 items-center justify-center self-end rounded-xl bg-cyan-600 p-3 text-white disabled:opacity-40"><Send size={18}/></button>
      </form>
      <Link to={"/agents?agent=" + encodeURIComponent(identity)} className="ifund-agent-panel-tool mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-cyan-300">Open full workspace <ExternalLink size={12}/></Link>
      <p className="mt-1 text-sm text-slate-300">Voice is optional. Check the words before sending. Spoken words do not approve any action.</p>
    </div>
  </aside>;
}
