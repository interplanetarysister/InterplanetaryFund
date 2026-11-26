import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Sparkles } from "lucide-react";
import { authClient } from "@/api/auth";
import { askIFundAgent } from "@/lib/agentQuestions";
import { canAskAgentWithSavedPermission } from "@/lib/agentAdvisoryPermission.mjs";
import AIPermissionPreferences from "@/components/permissions/AIPermissionPreferences";
import AgentConsultationTrail from "@/components/agents/AgentConsultationTrail";
import AgentDispatchCard from "@/components/agents/AgentDispatchCard";
import GoalKnowledgeCard from "@/components/agents/GoalKnowledgeCard";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";

const MAX_MESSAGE_LENGTH = 2000;
const ANALYSIS_PREFIX = "Please analyze my situation and suggest specific, realistic next steps, potential risks, and ways to measure progress. My request: ";
const emptyThreads = () => ({});

export default function MemberAgentChat({ user, agent }) {
  const ownerId = user?.id || null;
  const [drafts, setDrafts] = useState({});
  const [threads, setThreads] = useState(emptyThreads);
  const [permission, setPermission] = useState({ status: "loading", allowed: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consentRevision, setConsentRevision] = useState(0);
  const inFlight = useRef(null);
  const log = useRef(null);
  const ownerGuard = useRef(ownerId);
  ownerGuard.current = ownerId;

  const selected = Object.hasOwn(AGENT_IDENTITIES, agent) ? agent : "nexus";
  const draft = drafts[selected] || "";
  const messages = threads[selected] || [];

  useEffect(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setDrafts({});
    setThreads(emptyThreads());
    setError("");
    setBusy(false);
    setPermission({ status: "loading", allowed: false });
    return () => inFlight.current?.abort();
  }, [ownerId]);

  useEffect(() => {
    function changed(event) {
      if (event.detail?.ownerId === ownerId) {
        setConsentRevision(value => value + 1);
      }
    }
    window.addEventListener("ifund-ai-consent-changed", changed);
    return () => window.removeEventListener("ifund-ai-consent-changed", changed);
  }, [ownerId]);

  const checkPermission = useCallback(async (signal) => {
    if (!ownerId) return { status: "signed-out", allowed: false };
    const client = authClient();
    const [identity, saved] = await Promise.all([
      client.auth.getUser(),
      client.from("ifund_ai_permission_preferences")
        .select("owner_id,allow_ai_campaign_drafts,allow_ai_outreach_drafts,allow_future_internal_ai_assistance")
        .eq("owner_id", ownerId).maybeSingle()
    ]);
    if (signal?.aborted || ownerGuard.current !== ownerId) return null;
    if (identity.error || saved.error || identity.data?.user?.id !== ownerId)
      return {status:"unavailable", allowed:false};
    const allowed = canAskAgentWithSavedPermission({
      user: identity.data.user, ownerId, preferences: saved.data
    });
    return {status:"ready",allowed};
  }, [ownerId]);

  useEffect(() => {
    const controller = new AbortController();
    setPermission({status:"loading",allowed:false});
    checkPermission(controller.signal).then(value => {
      if (!controller.signal.aborted && value) setPermission(value);
    }).catch(() => {
      if (!controller.signal.aborted) setPermission({status:"unavailable",allowed:false});
    });
    return () => controller.abort();
  }, [checkPermission, consentRevision]);

  useEffect(() => {
    log.current?.scrollTo({top:log.current.scrollHeight,behavior:"smooth"});
  }, [messages.length, selected, busy]);

  async function submit(event, analyze = false) {
    event?.preventDefault?.();
    if (inFlight.current || busy || !ownerId || !permission.allowed) return;
    const input = draft.trim();
    if (!input || input.length > MAX_MESSAGE_LENGTH) return;
    const question = analyze ? ANALYSIS_PREFIX + input : input;
    if (question.length > MAX_MESSAGE_LENGTH) {
      setError("For analysis, shorten your request to " + (MAX_MESSAGE_LENGTH - ANALYSIS_PREFIX.length) + " characters.");
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    const requestOwner = ownerId;
    const requestAgent = selected;
    const requestId = crypto.randomUUID();
    setBusy(true);
    setError("");
    setDrafts(previous => ({...previous,[requestAgent]:""}));
    setThreads(previous => ({
      ...previous,
      [requestAgent]:[...(previous[requestAgent] || []),{
        id:requestId,kind:"user",text:input,analysis:analyze
      }]
    }));
    try {
      const result = await askIFundAgent(authClient(), {
        question, agent:requestAgent, ownerId:requestOwner, signal:controller.signal
      });
      if (controller.signal.aborted || ownerGuard.current !== requestOwner) return;
      setThreads(previous => ({
        ...previous,
        [requestAgent]:[...(previous[requestAgent] || []),{
          id:crypto.randomUUID(),kind:"answer",agent:result.agent,
          text:result.answer,consultations:result.consultations,dispatch:result.dispatch,goalKnowledge:result.goal_knowledge
        }]
      }));
    } catch (cause) {
      if (controller.signal.aborted || ownerGuard.current !== requestOwner) return;
      setDrafts(previous => ({...previous,[requestAgent]:input}));
      setThreads(previous => ({
        ...previous,
        [requestAgent]:(previous[requestAgent] || []).filter(item => item.id !== requestId)
      }));
      setError(cause?.message || "Your message could not be delivered. It is saved in the composer for retry.");
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setBusy(false);
      }
    }
  }

  return <section aria-label="Member AI chat" className="space-y-4 rounded-2xl border border-cyan-500/25 bg-card p-4 sm:p-5">
    <header className="flex items-center gap-3">
      <AgentIdentityIcon identity={selected} size={44}/>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">Chat with {AGENT_IDENTITIES[selected].name}</h2>
        <p className="text-sm text-muted-foreground">Personal AI guidance and analysis · available to free and subscribed members</p>
      </div>
    </header>

    <div ref={log} role="log" aria-label="Your conversation with the selected agent"
      aria-live="polite" className="max-h-[32rem] min-h-56 space-y-3 overflow-y-auto rounded-xl border border-border bg-background/70 p-4">
      {messages.length===0&&<div className="space-y-2 py-6 text-center text-muted-foreground">
        <Sparkles className="mx-auto size-7 text-cyan-500"/>
        <p className="font-semibold">Ask a question or request an analysis.</p>
        <p className="text-sm">Describe your goal, campaign, challenge, or idea. {AGENT_IDENTITIES[selected].name} can help you think it through.</p>
      </div>}
      {messages.map(message => <article key={message.id}
        className={"max-w-full space-y-2 rounded-xl p-3 text-sm "+
          (message.kind==="user"?"ml-auto bg-cyan-600/15 sm:max-w-[86%]":"mr-auto border border-border bg-card sm:max-w-[95%]")}>
        <div className="flex items-center gap-2 font-semibold">
          {message.kind==="answer"&&<AgentIdentityIcon identity={message.agent} size={28}/>}
          {message.kind==="user"?(message.analysis?"You · Analysis request":"You"):AGENT_IDENTITIES[message.agent]?.name||"AI Agent"}
        </div>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
        {message.kind==="answer"&&<AgentConsultationTrail consultations={message.consultations}/>}
        {message.kind==="answer"&&<AgentDispatchCard dispatch={message.dispatch}/>}
        {message.kind==="answer"&&<GoalKnowledgeCard goalKnowledge={message.goalKnowledge}/>}
      </article>)}
      {busy&&<p role="status" className="text-sm text-muted-foreground">Your agent is preparing a response…</p>}
    </div>

    {permission.status==="loading"&&<p role="status" className="text-sm">Checking your private AI permission…</p>}
    {permission.status==="unavailable"&&<div role="alert" className="space-y-2 text-sm">
      <p>AI permissions could not be verified. Your account's private messages have not been sent.</p>
      <button type="button" className="min-h-11 rounded-xl border border-border px-4"
        onClick={() => setConsentRevision(value => value+1)}>Retry permission check</button>
    </div>}
    {permission.status==="ready"&&!permission.allowed&&<div className="space-y-3">
      <p role="status" className="text-sm">Enable AI Assistance to use private agent chat and analysis. A subscription is not required.</p>
      <AIPermissionPreferences/>
    </div>}
    {error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

    <form onSubmit={event=>submit(event,false)} className="space-y-3">
      <label htmlFor="ifund-member-agent-message" className="block text-sm font-semibold">
        Your message to {AGENT_IDENTITIES[selected].name}
      </label>
      <textarea id="ifund-member-agent-message" rows={4} required maxLength={MAX_MESSAGE_LENGTH}
        value={draft} onChange={event => setDrafts(previous => ({...previous,[selected]:event.target.value}))}
        onKeyDown={event => {
          if (event.key==="Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            if (draft.trim() && permission.allowed && !busy) void submit(null,false);
          }
        }}
        placeholder="Ask a question, describe your goal, or request help with your campaign…"
        className="w-full resize-y rounded-xl border border-border bg-background p-3 text-base"
        aria-describedby="ifund-member-ai-help"/>
      <p id="ifund-member-ai-help" className="text-xs text-muted-foreground">
        Enter to send · Shift+Enter for a new line · Private advisory answers, not automatic actions.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!permission.allowed || busy || !draft.trim()}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-700 px-5 font-semibold text-white disabled:opacity-40">
          <Send size={17}/>{busy?"Responding…":"Send message"}
        </button>
        <button type="button" disabled={!permission.allowed || busy || !draft.trim()}
          onClick={()=>submit(null,true)}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-cyan-500/50 px-5 font-semibold disabled:opacity-40">
          <Sparkles size={17}/>Analyze my situation
        </button>
        <span className="text-xs text-muted-foreground">{draft.length}/{MAX_MESSAGE_LENGTH}</span>
      </div>
    </form>
    <p className="text-xs text-muted-foreground">Agent replies may contain mistakes. Nothing is published, paid, or sent outside iFund by this chat.</p>
    <Link className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-600 underline" to="/agents?tab=recommendations">
      View your analysis and recommendations tools
    </Link>
  </section>;
}
