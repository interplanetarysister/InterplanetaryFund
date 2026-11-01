import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Mail, Bell, Loader2 } from "lucide-react";
import { format } from "date-fns";

const typeLabels = {
  update: "Update",
  thank_you: "Thank You",
  announcement: "Announcement",
  milestone: "Milestone",
  volunteer: "Volunteer",
  sponsor: "Sponsor",
};

export default function MessageHistory({ refreshKey }) {
  const [messages, setMessages] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    base44.auth.me().then((me) =>
      base44.entities.Message.filter({ created_by_id: me.id }, "-created_date", 100).then(setMessages)
    );
  }, [refreshKey]);

  if (!messages) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const q = query.toLowerCase();
  const filtered = messages.filter(
    (m) =>
      !q ||
      m.subject?.toLowerCase().includes(q) ||
      m.campaign_title?.toLowerCase().includes(q) ||
      typeLabels[m.comm_type]?.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by subject, campaign, or type…" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">
          {messages.length === 0 ? "No communications sent yet." : "No messages match your search."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-900">{m.subject}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {m.campaign_title} · {m.sent_at ? format(new Date(m.sent_at), "MMM d, yyyy h:mm a") : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{typeLabels[m.comm_type] || m.comm_type}</Badge>
                  {m.ai_generated && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">AI</Badge>}
                </div>
              </div>
              <p className="text-sm text-stone-600 mt-2 line-clamp-2 whitespace-pre-line">{m.content}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                <span>{m.recipient_count} recipient{m.recipient_count === 1 ? "" : "s"}</span>
                {m.channels?.includes("email") && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {m.email_count} emails</span>}
                {m.channels?.includes("in_app") && <span className="flex items-center gap-1"><Bell className="w-3 h-3" /> {m.in_app_count} in-app</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}