import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import AgentChat from "@/components/agents/AgentChat";
import AgentContentReview from "@/components/agents/AgentContentReview";
import AdminDevelopmentChat from "@/components/agents/AdminDevelopmentChat";
import BrandLogo from "@/components/brand/BrandLogo";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { RefreshCw, Search, ChevronRight } from "lucide-react";

// Status comes from owner-scoped server records. Roster membership is never
// evidence that an agent is executing work for a member.
const EXECUTING = new Set(["responding", "in_progress"]);
const REQUIRES_USER = new Set(["waiting_user", "needs_review"]);
const FINISHED = new Set(["responded", "completed", "tool_failed", "failed", "delivery_unconfirmed"]);
const AGE_LIMIT_MS = 10 * 60 * 1000;

const timestamp = (entry) => {
  const t = Date.parse(entry?.updated_at || entry?.created_at || entry?.created_date || "");
  return Number.isFinite(t) ? t : 0;
};
const compact = (str, n = 105) => String(str || "").replace(/\s+/g, " ").trim().slice(0, n);
const readKey = (userId, agentName) => "ifund:agent-monitor:seen:" + userId + ":" + agentName;

function readSeen(userId, names) {
  const next = {};
  for (const name of names) {
    try { next[name] = Number(window.localStorage.getItem(readKey(userId, name))) || 0; }
    catch { next[name] = 0; }
  }
  return next;
}

function AgentPlanet({ kind }) {
  const halo = kind === "working" ? "ring-2 ring-cyan-500" :
    kind === "new" ? "ring-2 ring-amber-500" : "ring-1 ring-border";
  return <span className={"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + halo}>
    <BrandLogo size="sm" showName={false} />
  </span>;
}

function classify(agent, work, drafts, suggestions, seenAt, statusLoaded) {
  if (!statusLoaded) return { kind: "unknown", text: "Status unavailable", detail: "Try refreshing the monitor.", count: 0 };
  const items = work.filter((item) => item.agent === agent.name);
  const newest = [...items].sort((a, b) => timestamp(b) - timestamp(a))[0];
  const executing = items.find((item) => EXECUTING.has(item.status) &&
    timestamp(item) > Date.now() - AGE_LIMIT_MS);
  const toReview = drafts.filter((draft) => draft.status === "draft" && draft.source_agent === agent.name);
  // AgentActivity has no source-agent field: show these as team updates under
  // Chief of Staff, never falsely credit a particular specialist.
  const teamSuggestions = agent.name === "chief_of_staff" ?
    suggestions.filter((item) => item.status === "pending") : [];
  const freshSuggestions = [...toReview, ...teamSuggestions].filter((item) => timestamp(item) > seenAt);
  const newWork = items.filter((item) => FINISHED.has(item.status) && timestamp(item) > seenAt);
  const needsHelp = items.some((item) => REQUIRES_USER.has(item.status));
  if (executing) {
    return { kind: "working", text: "Working now",
      detail: compact(executing.objective || "Handling your request"), count: freshSuggestions.length + newWork.length };
  }
  if (freshSuggestions.length || newWork.length) {
    return { kind: "new", text: "New update",
      detail: freshSuggestions.length ? "New suggestion or prepared content to review" :
        compact(newWork[0]?.result_summary || newWork[0]?.objective || "Agent response available"),
      count: freshSuggestions.length + newWork.length };
  }
  if (needsHelp || toReview.length || teamSuggestions.length) {
    return { kind: "new", text: "Needs your review",
      detail: toReview.length || teamSuggestions.length ? "Prepared content or suggestions await review" :
        "An agent needs your input to continue",
      count: toReview.length + teamSuggestions.length };
  }
  if (newest?.status === "waiting_external") return { kind: "idle", text: "Waiting for provider",
    detail: compact(newest.objective || "External service response pending"), count: 0 };
  if (newest?.status === "requested" || newest?.status === "assigned") {
    return { kind: "idle", text: "Queued", detail: compact(newest.objective || "Request recorded"), count: 0 };
  }
  if (newest?.status === "responding" || newest?.status === "in_progress") {
    return { kind: "idle", text: "Update overdue", detail: "Previous work status has not been refreshed recently.", count: 0 };
  }
  return { kind: "idle", text: "Available", detail: "Available for assignments through Chief of Staff.", count: 0 };
}

export default function AgentMonitor({ user, agents, canUseAdminTools }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState("chat");
  const [work, setWork] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [seen, setSeen] = useState(() => readSeen(user.id, agents.map((agent) => agent.name)));
  const [loading, setLoading] = useState(true);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      base44.functions.invoke("manageAgentWork", { mode: "list", view: "all" }),
      base44.functions.invoke("trackAgentConversation", { mode: "list" }),
      base44.functions.invoke("manageAgentContentDraft", { mode: "list" }),
      base44.entities.AgentActivity.filter({ owner_user_id: user.id }, "-created_date", 50),
    ]);
    const data = results.map((result) => result.status === "fulfilled" ? result.value?.data : null);
    const tasks = Array.isArray(data[0]?.work) && data[0]?.ok ? data[0].work : null;
    const chats = Array.isArray(data[1]?.runs) && data[1]?.ok ? data[1].runs : null;
    const prepared = Array.isArray(data[2]?.drafts) && data[2]?.ok ? data[2].drafts : null;
    const suggestionsResult = results[3].status === "fulfilled" && Array.isArray(results[3].value)
      ? results[3].value : null;
    // Refresh actual specialist handoff results. A record marked "assigned"
    // is not completion; only a resolved specialist response can advance it.
    let checkedTasks = tasks;
    if (tasks !== null) {
      const active = tasks.filter((task) => task.status === "in_progress" &&
        task.agent !== "managed_connection_agent").slice(0, 8);
      if (active.length) {
        const checks = await Promise.allSettled(active.map((task) =>
          base44.functions.invoke("routeAgentTask", { mode: "status", delegation_id: task.id })));
        const updates = new Map(checks.flatMap((result) => {
          const handoff = result.status === "fulfilled" ? result.value?.data?.handoff : null;
          return handoff?.id ? [[handoff.id, handoff]] : [];
        }));
        checkedTasks = tasks.map((task) => {
          const updated = updates.get(task.id);
          return updated ? { ...task, status: updated.status, agent: updated.destination_agent,
            result_summary: updated.result_summary, updated_at: updated.updated_at } : task;
        });
      }
    }
    if (checkedTasks !== null) setWork(checkedTasks);
    if (chats !== null) setWork((current) => {
      // Keep fresh delegated tasks if their independent request succeeded.
      const source = checkedTasks !== null ? checkedTasks : current.filter((item) => item.kind !== "chat");
      return [...source, ...chats];
    });
    if (prepared !== null) setDrafts(prepared);
    if (suggestionsResult !== null) setSuggestions(suggestionsResult);
    const recordsAvailable = tasks !== null || chats !== null;
    const success = recordsAvailable || prepared !== null || suggestionsResult !== null;
    setStatusLoaded((current) => current || recordsAvailable);
    setError(recordsAvailable ? "" : success ? "Live work status could not be checked; review items may still appear." : "Activity could not be checked. Existing statuses may be out of date.");
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    let live = true;
    const update = () => { if (live && document.visibilityState !== "hidden") void refresh(); };
    update();
    const interval = window.setInterval(update, 60000);
    document.addEventListener("visibilitychange", update);
    return () => { live = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);

  const states = useMemo(() => agents.map((agent) => ({
    agent, signal: classify(agent, work, drafts, suggestions, seen[agent.name] || 0, statusLoaded),
  })), [agents, work, drafts, suggestions, seen, statusLoaded]);

  const canChatWithAgent = (agent) => agent.name === "chief_of_staff" || agent.name === "support" || agent.name === "support_agent";

  const openAgent = (agent) => {
    if (!canChatWithAgent(agent)) return;
    const now = Date.now();
    try { window.localStorage.setItem(readKey(user.id, agent.name), String(now)); }
    catch { /* A private browser may not persist read indicators. */ }
    setSeen((current) => ({ ...current, [agent.name]: now }));
    setChatMode("chat");
    setSelected(agent);
    setOpen(true);
  };

  const selectedAgent = selected && agents.find((agent) => agent.name === selected.name);
  const activeCount = states.filter((row) => row.signal.kind === "working").length;
  const attentionCount = states.filter((row) => row.signal.kind === "new").length;

  const visibleStates = states.filter(({ agent, signal }) =>
    (filter === "all" || (filter === "updates" && signal.kind === "new") || (filter === "working" && signal.kind === "working")) &&
    agent.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return <div className="mx-auto max-w-5xl px-3 pb-24 pt-4 sm:px-6 sm:pt-7">
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-foreground">Your AI Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chat with the Chief of Staff or Support. Follow specialist progress below.</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh agent activity"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground" title="Refresh">
        <RefreshCw className={"h-5 w-5 " + (loading ? "animate-spin" : "")} />
      </button>
    </header>
    <div className="mb-3 grid grid-cols-2 gap-2" aria-live="polite">
      <button type="button" onClick={() => setFilter(filter === "updates" ? "all" : "updates")}
        aria-pressed={filter === "updates"} className={"rounded-xl border p-3 text-left " + (filter === "updates" ? "border-primary bg-primary/10" : "border-border bg-card")}>
        <span className="block text-xl font-bold text-foreground">{attentionCount}</span>
        <span className="text-sm text-muted-foreground">Need attention</span>
      </button>
      <button type="button" onClick={() => setFilter(filter === "working" ? "all" : "working")}
        aria-pressed={filter === "working"} className={"rounded-xl border p-3 text-left " + (filter === "working" ? "border-primary bg-primary/10" : "border-border bg-card")}>
        <span className="block text-xl font-bold text-foreground">{activeCount}</span>
        <span className="text-sm text-muted-foreground">Working now</span>
      </button>
    </div>
    <label className="mb-3 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground">
      <Search className="h-4 w-4 shrink-0" />
      <span className="sr-only">Search agents</span>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Find an agent" className="min-w-0 w-full bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted-foreground" />
    </label>
    <div className="mb-3 flex items-center justify-between gap-2">
      <div role="group" aria-label="Filter agents" className="flex flex-wrap gap-2">
        {[["all", "All"], ["updates", "Updates"], ["working", "Working"]].map(([value, title]) =>
          <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
            className={"min-h-10 rounded-full px-4 text-sm font-semibold " + (filter === value ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground")}>{title}</button>)}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{visibleStates.length} agents</span>
    </div>
    {error && <p role="alert" className="mb-3 rounded-xl border border-amber-500/50 bg-card p-3 text-sm text-foreground">{error}</p>}
    {loading && !statusLoaded && <p role="status" className="mb-3 text-sm text-muted-foreground">Checking agent activity…</p>}
    <section aria-label="Monitored agents" className="space-y-2">
      {visibleStates.length === 0 && <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">No agents match. Try All or clear your search.</div>}
      {visibleStates.map(({ agent, signal }) => {
        const Icon = agent.icon;
        return <button type="button" key={agent.name} onClick={() => openAgent(agent)}
          className="flex min-h-[76px] w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={(canChatWithAgent(agent) ? "Talk to " : "Specialist status: ") + agent.label + ", " + signal.text}>
          <AgentPlanet kind={signal.kind} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{agent.label}</span>
            </span>
            <span className="mt-1 block truncate text-sm text-muted-foreground">{signal.kind === "idle" && signal.text === "Available" ? (canChatWithAgent(agent) ? "Tap to chat" : "Works through Chief of Staff") : signal.detail}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex max-w-[80px] flex-col items-end text-right">
              <span className={"text-xs font-semibold " + (signal.kind === "new" ? "text-amber-700 dark:text-amber-300" : signal.kind === "working" ? "text-cyan-700 dark:text-cyan-300" : "text-muted-foreground")}>{signal.text}</span>
              {signal.count > 0 && <span className="text-xs text-muted-foreground">{signal.count} new</span>}
            </span>
            {canChatWithAgent(agent) && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </span>
        </button>;
      })}
    </section>
    <p className="mt-4 text-xs text-muted-foreground">Agents only act with your permission. Review prepared work before it is published.</p>

    <Sheet open={open} onOpenChange={(next) => { setOpen(next); if (!next) void refresh(); }}>
      <SheetContent side="right" className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-12 sm:w-[min(95vw,48rem)] sm:max-w-[48rem]">
        {selectedAgent && <>
          <SheetHeader className="shrink-0 text-left">
            <SheetTitle className="flex items-center gap-3 text-lg"><AgentPlanet kind={states.find((s) => s.agent.name === selectedAgent.name)?.signal.kind || "idle"} />{selectedAgent.label}</SheetTitle>
            <SheetDescription>Ask about your campaigns, account, or the work you want this agent to do.</SheetDescription>
          </SheetHeader>
          {canUseAdminTools && selectedAgent.name === "chief_of_staff" && <div role="group" aria-label="Admin chat access" className="mt-2 flex shrink-0 gap-2">
            <button type="button" aria-pressed={chatMode === "chat"} onClick={() => setChatMode("chat")} className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " + (chatMode === "chat" ? "bg-primary text-primary-foreground" : "bg-card text-foreground")}>Chat</button>
            <button type="button" aria-pressed={chatMode === "admin"} onClick={() => setChatMode("admin")} className={"min-h-11 rounded-lg border px-3 text-sm font-semibold " + (chatMode === "admin" ? "bg-primary text-primary-foreground" : "bg-card text-foreground")}>Admin tools</button>
          </div>}
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card p-2 sm:p-3">
            {canUseAdminTools && selectedAgent.name === "chief_of_staff" && chatMode === "admin"
              ? <div className="min-h-0 flex-1 overflow-y-auto"><AdminDevelopmentChat user={user} /></div>
              : <AgentChat key={selectedAgent.name} agentName={selectedAgent.name} agentLabel={selectedAgent.label} greeting={selectedAgent.greeting} overlayMode />}
          </div>
          <details className="mt-3 shrink-0 rounded-xl border border-border bg-card p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Review suggestions and prepared content</summary>
            <div className="max-h-[35dvh] overflow-y-auto pt-3"><AgentContentReview /></div>
          </details>
        </>}
      </SheetContent>
    </Sheet>
  </div>;
}
