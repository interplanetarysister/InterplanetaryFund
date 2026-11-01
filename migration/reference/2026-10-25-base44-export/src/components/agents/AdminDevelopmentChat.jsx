import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, LockKeyhole, Send } from "lucide-react";
import { createAdminAgentSession, sendAdminAgentMessage, adminGatewayMode } from "@/lib/adminAgentGateway";
import { getFrontendIdentity } from "@/lib/adminBootstrap";
import PlatformFixReviewPanel from "@/components/agents/PlatformFixReviewPanel";
import ChatGPTBuilderHandoff from "@/components/agents/ChatGPTBuilderHandoff";

const adminErrorMessage = (error) => {
  const message = String(error?.message || "");
  if (/key rejected/i.test(message)) return "The admin development key was rejected. Check it and try again.";
  if (/forbidden|unauthorized|super.admin|administrator authorization/i.test(message))
    return "This signed-in account is not verified as a super-admin. Sign in with an authorized owner account.";
  if (/not configured|failed to fetch|network|unreachable/i.test(message))
    return "The admin gateway is unavailable on this host. Its server configuration needs repair.";
  return "Admin access could not be verified. Refresh your sign-in and try again.";
};

const DEVELOPMENT_AGENTS = [
  ["admin_builder_agent", "Internal builder coordinator"],
  ["chief_of_staff", "Chief of Staff"],
  ["connection_discovery_agent", "Connection Discovery"],
  ["managed_connection_agent", "Managed Connections"],
  ["outreach_agent", "Outreach"],
];

export default function AdminDevelopmentChat({ user }) {
  const [key, setKey] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [agent, setAgent] = useState("admin_builder_agent");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!getFrontendIdentity(user).superAdminOwner) return null;

  const unlock = async () => {
    setBusy(true); setError("");
    try {
      const result = await createAdminAgentSession({ adminKey: key, agent: "admin_builder_agent" });
      setSessionId(result.sessionId);
      setKey("");
    } catch (e) { console.error("Admin development session failed:", e?.name || "UnknownError"); setError(adminErrorMessage(e)); } finally { setBusy(false); }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || !sessionId || busy) return;
    setInput(""); setBusy(true); setError("");
    setMessages(m => [...m, { role: "user", content }]);
    try {
      const result = await sendAdminAgentMessage({ sessionId, content, agent });
      setMessages(m => [...m, { role: "assistant", content: result.response || "Request recorded." }]);
    } catch (e) { console.error("Admin development message failed:", e?.name || "UnknownError"); setError(adminErrorMessage(e)); setInput(content); } finally { setBusy(false); }
  };

  return <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-4">
    {/* The ChatGPT handoff and fix inbox use independent server-verified
        super-admin functions: never make them depend on native agent chat. */}
    <ChatGPTBuilderHandoff />
    <PlatformFixReviewPanel />
    <details className="rounded-xl border border-border bg-background p-3">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Optional: IFund internal agent conversations (separate from ChatGPT)
      </summary>
      <div className="pt-3 space-y-3">
        {!sessionId ? <>
          <p className="text-sm text-muted-foreground">
            The internal agent session is optional. If it fails, you can still prepare and open ChatGPT builder tasks above.
            Its builder coordinator only queues or reviews tasks and does not use your ChatGPT plugins.
          </p>
          <div className="flex flex-wrap items-center gap-2 font-medium text-sm text-foreground">
            <LockKeyhole className="w-4 h-4" /> Verify internal development-agent access
          </div>
          <div className="flex flex-wrap gap-2">
            {adminGatewayMode === "external" && agent !== "admin_builder_agent" &&
              <Input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}
                placeholder="Admin key" className="min-w-0 flex-1"/>}
            <Button type="button" className="min-h-11" onClick={unlock}
              disabled={(adminGatewayMode === "external" && agent !== "admin_builder_agent" && !key) || busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin"/> : "Verify admin access"}
            </Button>
          </div>
        </> : <>
          <p className="text-xs text-muted-foreground">
            Internal IFund agents run on Base44; use the ChatGPT builder handoff above for this ChatGPT account and its connected tools.
          </p>
          <div className="flex flex-wrap gap-2">
            {DEVELOPMENT_AGENTS.map(([id,label])=><Button type="button" key={id} size="sm"
              variant={agent===id?"default":"outline"} onClick={()=>setAgent(id)}>{label}</Button>)}
          </div>
          <div className="min-h-[22dvh] max-h-[55dvh] overflow-y-auto overscroll-contain touch-pan-y space-y-2" aria-label="Internal agent messages">
            {messages.map((m,i)=><div key={i} className={m.role==="user"?"text-right":"text-left"}>
              <span className="inline-block max-w-[90%] rounded-xl border border-border px-3 py-2 text-base leading-relaxed whitespace-pre-wrap break-words">{m.content}</span>
            </div>)}
          </div>
          <div className="flex gap-2 items-end">
            <Textarea value={input} onChange={e=>setInput(e.target.value)}
              placeholder={"Message "+(DEVELOPMENT_AGENTS.find(([id])=>id===agent)?.[1]||"Agent")+"…"} rows={1}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
            <Button type="button" size="icon" onClick={send} disabled={busy||!input.trim()}
              aria-label="Send to internal agent">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>}</Button>
          </div>
        </>}
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </details>
  </div>;
}

