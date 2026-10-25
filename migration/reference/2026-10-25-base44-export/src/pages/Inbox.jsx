import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MailOpen } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import InboxItemCard from "@/components/inbox/InboxItemCard";
import VerificationInboxPanel from "@/components/inbox/VerificationInboxPanel";
import { platformName } from "@/components/connections/platformCatalog";
import PageError from "@/components/PageError";
import AdminApprovalQueue from "@/components/admin/AdminApprovalQueue";

// The Universal Inbox — one communication center aggregating connected-platform
// interactions (InboxItems, e.g. live Ko-fi gifts), Interplanetary Fund
// donations to your campaigns, and your notifications.
export default function Inbox() {
  const [searchParams] = useSearchParams();
  const requestedCampaign = searchParams.get("campaign") || "all";
  const [items, setItems] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(requestedCampaign === "all" ? "open" : "all");
  const [platform, setPlatform] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState(requestedCampaign);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setCampaignFilter(requestedCampaign);
    if (requestedCampaign !== "all") setTab("all");
  }, [requestedCampaign]);

  useEffect(() => {
    (async () => {
     try {
      const me = await base44.auth.me();
      setIsAdmin(me.role === "admin");
      const [inboxItems, notifications, myCampaigns] = await Promise.all([
        base44.entities.InboxItem.filter({ user_id: me.id }, "-created_date", 100),
        base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50),
        base44.entities.Campaign.filter({ created_by_id: me.id }),
      ]);
      const dResults = await Promise.all(
        myCampaigns.map((c) => base44.functions.invoke("getCampaignDonations", { campaign_id: c.id }))
      );
      const donationLists = dResults.map((r) => (r.data && r.data.donations) || []);

      const merged = [
        ...inboxItems.map((i) => ({
          key: `i-${i.id}`, record_id: i.id, platform: i.platform, type: i.type, author: i.author,
          content: i.content, link: i.link, campaign_id: i.campaign_id,
          recipient_address: i.recipient_address, mailbox_priority: i.mailbox_priority,
          campaign_title: i.campaign_title || myCampaigns.find((c) => c.id === i.campaign_id)?.title,
          status: i.status, date: i.created_date, ai_draft: i.ai_draft,
        })),
        ...donationLists.flat().map((d) => ({
          key: `d-${d.id}`, platform: "interplanetary", type: "donation", author: d.donor_name || "Anonymous",
          content: `Gave $${(d.amount || 0).toLocaleString()}${d.message ? ` — "${d.message}"` : ""}`,
          link: `/campaign/${d.campaign_id}`, campaign_id: d.campaign_id, campaign_title: d.campaign_title,
          status: "done", date: d.created_date,
        })),
        ...notifications.map((n) => ({
          key: `n-${n.id}`, notification_id: n.id, platform: "interplanetary", type: n.type === "donation" ? "donation" : "system",
          author: "", content: `${n.title}${n.body ? ` — ${n.body}` : ""}`, link: n.link,
          status: n.read ? "done" : "open", date: n.created_date,
          campaign_id: n.campaign_id ||
            /^\/campaign\/([a-zA-Z0-9_-]{1,128})(?:[?#]|$)/.exec(String(n.link || ""))?.[1] || "",
          campaign_title: myCampaigns.find(c => c.id === (n.campaign_id ||
            /^\/campaign\/([a-zA-Z0-9_-]{1,128})(?:[?#]|$)/.exec(String(n.link || ""))?.[1]))?.title,
          notification_title: n.title, notification_body: n.body, notification_type: n.type,
        })),
      ].sort((a, b) => {
        const aPriority = a.status === 'open' && a.platform === 'email' && a.mailbox_priority === 'priority' ? 1 : 0;
        const bPriority = b.status === 'open' && b.platform === 'email' && b.mailbox_priority === 'priority' ? 1 : 0;
        return bPriority - aPriority || new Date(b.date) - new Date(a.date);
      });

      setItems(merged);
     } catch (e) {
       console.error("Inbox load failed:", e?.name || "UnknownError");
       setError("We couldn't load your inbox. Please try again.");
     }
    })();
  }, [refreshKey]);

  if (error) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setItems(null); setRefreshKey((k) => k + 1); }} /></div>;
  }
  if (!items) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const platforms = [...new Set(items.map((i) => i.platform))];
  const campaigns = [...new Map(items.filter((i) => i.campaign_id && i.campaign_title).map((i) => [i.campaign_id, i.campaign_title])).entries()];

  const visible = items.filter((i) =>
    (tab === "all" || i.status === tab) &&
    (platform === "all" || i.platform === platform) &&
    (campaignFilter === "all" || i.campaign_id === campaignFilter) &&
    (!search || `${i.author} ${i.content} ${i.campaign_title || ""}`.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900 mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <MailOpen className="w-5 h-5 text-white" />
        </span>
        Universal Inbox
      </h1>
      <p className="text-stone-500 mb-6">Every donation, comment, and alert from every connected platform — one communication center.</p>
      <div className="mb-6"><VerificationInboxPanel /></div>
      {isAdmin && <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <h2 className="font-display text-lg text-stone-900 mb-1">Admin action inbox</h2>
        <p className="text-sm text-stone-500 mb-4">Requests from agents and the platform that need a decision, account sign-in, more information, or investigation.</p>
        <AdminApprovalQueue />
      </div>}

      <div className="flex flex-wrap gap-3 mb-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => <SelectItem key={p} value={p}>{p === "interplanetary" ? "Interplanetary Fund" : platformName(p)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="flex-1 min-w-40" />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-16">Nothing here — donations, comments, and alerts from your connected platforms will appear in this inbox.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((i) => (
            <InboxItemCard key={i.key} item={i} onChanged={(u) => setItems((prev) => prev.map((x) => (x.key === u.key ? u : x)))} />
          ))}
        </div>
      )}
    </PullToRefresh>
  );
}