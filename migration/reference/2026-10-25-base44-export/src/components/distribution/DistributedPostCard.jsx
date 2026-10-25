import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Copy, Check, CalendarClock, Trash2, ExternalLink } from "lucide-react";
import { platformName } from "@/components/connections/platformCatalog";
import { officialProviderSite } from "@/lib/providerOnboardingLinks";

const statusStyles = {
  draft: "bg-stone-100 text-stone-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  scheduled: "bg-violet-100 text-violet-700",
  published: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

// One AI-generated platform post: edit, approve & publish (direct API where
// supported, copy-to-post otherwise), schedule, or discard.
export default function DistributedPostCard({ post, onChanged, onRemoved }) {
  const [content, setContent] = useState(post.content);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [notice, setNotice] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  const fullText = [content, ...(post.hashtags || [])].join(" ").trim();

  const saveEdit = async () => {
    if (content === post.content) return;
    const { data } = await base44.functions.invoke("manageDistributedPost", { action: "edit", post_id: post.id, content });
    if (data?.ok !== true) throw new Error("Post edit rejected");
    onChanged(data.post);
  };

  const publish = async () => {
    setBusy(true);
    setNotice("");
    try {
      await saveEdit();
      // This owner click authorizes only this post, not ongoing AI posting.
      const { data } = await base44.functions.invoke("publishPost", { post_id: post.id, user_publish_authorized: true });
      if (data?.error) setNotice("Publishing could not be completed. Review the destination and try again.");
      else if (data?.manual) {
        onChanged(data.post);
        setManualUrl(/^https:\/\//i.test(data.profile_url || "") ? data.profile_url : officialProviderSite(post.platform));
        setNotice(`${data.reason || "Direct publishing is not available for this account."} Copy the content and open your account to finish publishing.`);
      } else if (data?.post) {
        onChanged(data.post);
        setManualUrl("");
        setNotice("Published successfully. Open View post to verify.");
      } else setNotice("The publishing result could not be confirmed. Check the destination before retrying.");
    } catch (e) {
      console.error("Distributed post publish failed:", e?.name || "UnknownError");
      setNotice("Publishing failed safely. Review the connection and try again.");
    }
    setBusy(false);
  };

  const schedule = async () => {
    if (!scheduleAt) return;
    setBusy(true);
    await saveEdit();
    const { data } = await base44.functions.invoke("manageDistributedPost", { action: "schedule", post_id: post.id, scheduled_for: new Date(scheduleAt).toISOString() });
    if (data?.ok !== true) throw new Error("Post schedule rejected");
    onChanged(data.post);
    setShowSchedule(false);
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    const { data } = await base44.functions.invoke("manageDistributedPost", { action: "delete", post_id: post.id });
    if (data?.ok !== true || data?.deleted !== true) throw new Error("Post deletion rejected");
    onRemoved(post.id);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-semibold text-stone-900 text-sm">{platformName(post.platform)}</p>
        <Badge className={`${statusStyles[post.status] || ""} border-0 capitalize`}>{post.status.replace("_", " ")}</Badge>
      </div>
      {post.status === "published" ? (
        <p className="text-sm text-stone-600 whitespace-pre-line">{fullText}</p>
      ) : (
        <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} onBlur={saveEdit} className="text-sm" />
      )}
      {post.donation_destination_url && (
        <p className="mt-2 break-all text-xs text-slate-600">Donation destination ({post.donation_destination_platform==="ifund"?"IFund":"external provider"}):{" "}
          <a href={post.donation_destination_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{post.donation_destination_url}</a>
        </p>
      )}
      {post.error && <p className="text-xs text-red-600 mt-1.5">Last error: {post.error} (attempt {post.retry_count || 0}/3)</p>}
      {post.scheduled_for && post.status === "scheduled" && (
        <p className="text-xs text-violet-600 mt-1.5">Scheduled for {new Date(post.scheduled_for).toLocaleString()}</p>
      )}
      {notice && <p className="text-xs text-amber-700 mt-1.5">{notice}</p>}

      <div className="flex flex-wrap gap-2 mt-3">
        {post.status !== "published" && (
          <Button size="sm" onClick={publish} disabled={busy} className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Approve & publish
          </Button>
        )}
        {post.status !== "published" && (
          <Button size="sm" variant="outline" onClick={() => setShowSchedule((v) => !v)} className="rounded-lg">
            <CalendarClock className="w-3.5 h-3.5" /> Schedule
          </Button>
        )}
        {manualUrl && post.status !== "published" && (
          <a href={manualUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
            <Button size="sm" type="button" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> Open platform to post</Button>
          </a>
        )}
        <Button size="sm" variant="outline" onClick={copy} className="rounded-lg">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
        </Button>
        {post.external_post_url && (
          <a href={post.external_post_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="rounded-lg"><ExternalLink className="w-3.5 h-3.5" /> View post</Button>
          </a>
        )}
        {post.status !== "published" && (
          <Button size="sm" variant="outline" onClick={remove} disabled={busy} className="rounded-lg text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
        )}
      </div>
      {showSchedule && (
        <div className="flex gap-2 mt-2">
          <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="max-w-56" />
          <Button size="sm" onClick={schedule} disabled={busy || !scheduleAt} className="rounded-lg">Set</Button>
        </div>
      )}
    </div>
  );
}