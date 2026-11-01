import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Pin, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const categoryLabels = {
  announcement: "Announcement",
  question: "Question",
  idea: "Idea",
  success_story: "Success Story",
  coordination: "Coordination",
  support: "Support",
};

export default function PostCard({ post, isMember }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyCount, setReplyCount] = useState(post.reply_count || 0);

  const toggleReplies = async () => {
    if (!showReplies && replies === null) {
      setReplies(await base44.entities.DiscussionReply.filter({ post_id: post.id }, "created_date"));
    }
    setShowReplies(!showReplies);
  };

  const sendReply = async () => {
    setSending(true);
    const { data } = await base44.functions.invoke("postDiscussionReply", {
      post_id: post.id,
      community_id: post.community_id,
      content: replyText,
    });
    if (data?.reply) {
      setReplies((prev) => [...(prev || []), data.reply]);
      setReplyCount((c) => c + 1);
      setReplyText("");
    } else if (data?.error) {
      alert("The reply could not be posted. Please try again.");
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900 flex items-center gap-1.5">
            {post.pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
            {post.title}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            {post.author_name} · {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="secondary">{categoryLabels[post.category] || post.category}</Badge>
      </div>
      {post.content && <p className="text-sm text-stone-600 mt-2 whitespace-pre-line">{post.content}</p>}

      <button onClick={toggleReplies} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 mt-3">
        <MessageCircle className="w-3.5 h-3.5" />
        {replyCount} {replyCount === 1 ? "reply" : "replies"}
      </button>

      {showReplies && (
        <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
          {(replies || []).map((r) => (
            <div key={r.id} className="rounded-xl bg-stone-50 px-4 py-3">
              <p className="text-xs font-semibold text-stone-700">{r.author_name}</p>
              <p className="text-sm text-stone-600 mt-0.5 whitespace-pre-line">{r.content}</p>
            </div>
          ))}
          {isMember && (
            <div className="flex gap-2">
              <Textarea rows={1} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply…" className="min-h-[40px]" />
              <Button size="sm" onClick={sendReply} disabled={sending || !replyText.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground self-end">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Reply"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}