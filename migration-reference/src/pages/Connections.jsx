import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, Rocket, Share2 } from "lucide-react";
import { CROWDFUNDING_PLATFORMS, SOCIAL_PLATFORMS, ALL_PLATFORMS } from "@/components/connections/platformCatalog";
import AIConsentCard from "@/components/connections/AIConsentCard";
import ConnectionCard from "@/components/connections/ConnectionCard";
import ConnectDialog from "@/components/connections/ConnectDialog";

// The Universal Connections Center — connect once, fund everywhere. Every
// crowdfunding platform and social network Interplanetary Fund can reach,
// managed from a single place.
export default function Connections() {
  const [connections, setConnections] = useState(null);
  const [user, setUser] = useState(null);
  const [dialog, setDialog] = useState(null); // { platform, existing }

  useEffect(() => {
    (async () => {
      const [me, list] = await Promise.all([
        base44.auth.me(),
        base44.entities.PlatformConnection.list("-updated_date", 100),
      ]);
      setUser(me);
      setConnections(list);
    })();
  }, []);

  if (!connections) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const aiAuthorized = !!user?.ai_publishing_consent?.granted;
  const connectedIds = connections.map((c) => c.platform);
  const kinds = { crowdfunding: CROWDFUNDING_PLATFORMS, social: SOCIAL_PLATFORMS };

  const catalogSection = (title, Icon, items) => (
    <div className="mb-8">
      <h2 className="flex items-center gap-2 font-display text-xl text-stone-900 mb-3"><Icon className="w-4 h-4 text-primary" /> {title}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.filter((p) => p.id === "custom" || !connectedIds.includes(p.id)).map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-stone-900">{p.name}</p>
              <p className="text-xs text-stone-400 mt-0.5">{p.api}</p>
            </div>
            <Button size="sm" onClick={() => setDialog({ platform: { ...p, kind: items === CROWDFUNDING_PLATFORMS ? "crowdfunding" : "social" } })} className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
              Connect
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900 mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-white" />
        </span>
        Connections
      </h1>
      <p className="text-stone-500 mb-6">Create once. Connect once. Fund everywhere. Manage every fundraising and social destination from one place.</p>

      <div className="mb-8">
        <AIConsentCard user={user} onChanged={(v) => setUser((u) => ({ ...u, ai_publishing_consent: v }))} />
      </div>

      {connections.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-xl text-stone-900 mb-3">Connected</h2>
          <div className="space-y-3">
            {connections.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                platform={ALL_PLATFORMS.find((p) => p.id === c.platform)}
                onManage={() => setDialog({ platform: { ...(ALL_PLATFORMS.find((p) => p.id === c.platform) || { id: c.platform, name: c.platform, api: "" }), kind: c.kind }, existing: c })}
                onRemoved={(id) => setConnections((prev) => prev.filter((x) => x.id !== id))}
                onUpdated={(u) => setConnections((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              />
            ))}
          </div>
        </div>
      )}

      {catalogSection("Crowdfunding platforms", Rocket, kinds.crowdfunding)}
      {catalogSection("Social networks", Share2, kinds.social)}

      {dialog && (
        <ConnectDialog
          platform={dialog.platform}
          existing={dialog.existing}
          aiAuthorized={aiAuthorized}
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          onSaved={(saved) =>
            setConnections((prev) => {
              const exists = prev.some((x) => x.id === saved.id);
              return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
            })
          }
        />
      )}
    </div>
  );
}