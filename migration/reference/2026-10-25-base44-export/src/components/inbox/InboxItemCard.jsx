import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { draftInboxReply } from "@/lib/creditFreeGenerators";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Check, ExternalLink, Sparkles, Loader2, Copy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { platformName } from "@/components/connections/platformCatalog";
import { contextualNotificationDestination, safeActionRoute } from "@/lib/actionDestinations";

const typeColors = {
  donation: "bg-emerald-100 text-emerald-700",
  comment: "bg-blue-100 text-blue-700",
  message: "bg-violet-100 text-violet-700",
  mention: "bg-cyan-100 text-cyan-700",
  reply: "bg-blue-100 text-blue-700",
  question: "bg-amber-100 text-amber-700",
  system: "bg-stone-100 text-stone-600",
};

// One inbox item: source, content, deep link to the original conversation,
// AI draft response for review, and mark-complete.
export default function InboxItemCard({ item, onChanged }) {
  const navigate = useNavigate();
  const notificationDestination = item.notification_id
    ? contextualNotificationDestination({
      link: item.link, title: item.notification_title, body: item.notification_body,
      type: item.notification_type, campaign_id: item.campaign_id,
    })
    : safeActionRoute(item.link);
  const externalOriginal = typeof item.link === "string" && /^https:\/\//i.test(item.link);
  const [draft, setDraft] = useState(item.ai_draft || "");
  const [drafting, setDrafting] = useState(false);
  const [showDraft, setShowDraft] = useState(!!item.ai_draft);
  const [copied, setCopied] = useState(false);

  const generateDraft = async () => {
    setDrafting(true);
    setShowDraft(true);
    const text = draftInboxReply(item, platformName(item.platform));
    setDraft(text);
    if (item.record_id) { const { data } = await base44.functions.invoke("updateInboxItem", { item_id: item.record_id, ai_draft: text }); if (data?.ok !== true) throw new Error("Inbox draft update rejected"); }
    setDrafting(false);
  };

  const markDone = async () => {
    if (item.record_id) { const { data } = await base44.functions.invoke("updateInboxItem", { item_id: item.record_id, status: "done" }); if (data?.ok !== true) throw new Error("Inbox status update rejected"); }
    else if (item.notification_id) { const { data } = await base44.functions.invoke("markNotificationRead", { notification_id: item.notification_id }); if (data?.ok !== true) throw new Error("Notification update rejected"); }
    onChanged({ ...item, status: "done" });
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 ${item.status === "done" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{platformName(item.platform)}</Badge>
            <Badge className={`${typeColors[item.type] || typeColors.system} border-0 capitalize`}>{item.type}</Badge>
            {item.platform === "email" && item.mailbox_priority === "priority" && <Badge className="bg-amber-100 text-amber-900 border-0">Priority</Badge>}
            {item.platform === "email" && item.recipient_address && <span className="text-xs text-stone-600 break-all">To: {item.recipient_address}</span>}
            {item.campaign_title && <span className="text-xs text-stone-400 truncate">{item.campaign_title}</span>}
          </div>
          <p className="text-sm text-stone-800 mt-2">
            {item.author && <span className="font-semibold">{item.author}: </span>}
            {item.content}
          </p>
          <p className="text-xs text-stone-400 mt-1">{item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : ""}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {item.status !== "done" && (
          <Button size="sm" variant="outline" onClick={markDone} className="rounded-lg"><Check className="w-3.5 h-3.5" /> Done</Button>
        )}
        <Button size="sm" variant="outline" onClick={generateDraft} disabled={drafting} className="rounded-lg text-primary">
          {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Draft reply
        </Button>
        {(notificationDestination || externalOriginal) && (
          externalOriginal ? (
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> Open original</Button>
            </a>
          ) : (
            <Button size="sm" variant="outline" onClick={() => navigate(notificationDestination)} className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> Open action</Button>
          )
        )}
      </div>

      {showDraft && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <p className="text-xs font-semibold text-stone-500 mb-1.5">Credit-free draft — review and edit before sending</p>
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} className="text-sm" />
          <Button size="sm" variant="outline" onClick={copyDraft} disabled={!draft} className="rounded-lg mt-2">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy reply
          </Button>
        </div>
      )}
    </div>
  );
}