import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldAlert } from "lucide-react";
import ExternalAccountsSummary from "@/components/admin/ExternalAccountsSummary";
import ExternalAccountsTable from "@/components/admin/ExternalAccountsTable";
import AccountDetailPanel from "@/components/admin/AccountDetailPanel";
import PostLookupPanel from "@/components/admin/PostLookupPanel";
import ActionQueuePanel from "@/components/admin/ActionQueuePanel";
import AdminApprovalQueue from "@/components/admin/AdminApprovalQueue";
import PageError from "@/components/PageError";

export default function ExternalAccounts() {
  const [user, setUser] = useState(null);
  const [connections, setConnections] = useState(null);
  const [posts, setPosts] = useState(null);
  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState({});
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
        if (me.role !== "admin") return;
        const [cs, ps, ags, camps] = await Promise.all([
          base44.functions.invoke("listConnections", { scope: "all" }).then((r) => r.data.connections),
          base44.entities.DistributedPost.list("-created_date", 300),
          base44.entities.Agent.list().catch(() => []),
          base44.entities.Campaign.list("-created_date", 200),
        ]);
        setConnections(cs);
        setPosts(ps);
        setAgents(ags);
        setCampaigns(Object.fromEntries(camps.map((c) => [c.id, c])));
      } catch (e) {
        console.error("External accounts load failed:", e?.name || "UnknownError");
        setError("Couldn't load external accounts. Please try again.");
      }
    })();
  }, [refreshKey]);

  if (!user) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto" />
        <h1 className="font-display text-2xl text-stone-900 mt-4">Administrators only</h1>
        <p className="text-stone-500 mt-2">External account management is restricted to platform administrators.</p>
      </div>
    );
  }

  if (error) return <div className="max-w-6xl mx-auto px-4 py-10"><PageError message={error} onRetry={() => { setError(null); setConnections(null); setPosts(null); setRefreshKey((k) => k + 1); }} /></div>;
  if (!connections || !posts) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const reload = () => setRefreshKey((k) => k + 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900">External Accounts</h1>
      <p className="text-stone-500 mt-1 mb-6">Every connected platform account — its agent, campaign, health, and posts — in one place.</p>

      <ExternalAccountsSummary connections={connections} />

      <Tabs defaultValue="accounts" className="mt-8">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="accounts">Accounts ({connections.length})</TabsTrigger>
          <TabsTrigger value="posts">Post Lookup ({posts.length})</TabsTrigger>
          <TabsTrigger value="approvals">Automation Approvals</TabsTrigger>
          <TabsTrigger value="queue">Account Issues</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <ExternalAccountsTable connections={connections} campaigns={campaigns} agents={agents} onRowClick={setSelected} onUpdated={reload} />
        </TabsContent>
        <TabsContent value="posts">
          <PostLookupPanel posts={posts} campaigns={campaigns} agents={agents} connections={connections} />
        </TabsContent>
        <TabsContent value="approvals">
          <AdminApprovalQueue />
        </TabsContent>
        <TabsContent value="queue">
          <ActionQueuePanel connections={connections} campaigns={campaigns} onResolved={reload} />
        </TabsContent>
      </Tabs>

      <AccountDetailPanel connection={selected} campaigns={campaigns} agents={agents} posts={posts} onClose={() => setSelected(null)} onSynced={reload} />
    </div>
  );
}