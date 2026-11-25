import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AIPermissionPreferences from "@/components/permissions/AIPermissionPreferences";
import MarketingPreferences from "./MarketingPreferences";
import CommunicationPreferences from "@/components/CommunicationPreferences";
import Connections from "./Connections";
import PublishingWorkflowNav from "@/components/communications/PublishingWorkflowNav";
import CampaignDocumentPermissions from "@/components/permissions/CampaignDocumentPermissions";

export default function ManagePermissions() {
  const location = useLocation();
  const requestedSection=new URLSearchParams(location.search).get("section");
  const [open,setOpen] = useState(location.pathname === "/connections" ? "platforms" : ["ai","platforms","marketing","supporter-updates","documents"].includes(requestedSection)?requestedSection:"ai");
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <PublishingWorkflowNav current="connections"/>
    <header className="space-y-2">
      <p className="text-sm font-semibold text-primary">My Account / My Profile</p>
      <h1 className="font-display text-3xl font-bold">Manage iFund Permissions</h1>
      <p className="text-muted-foreground">Manage AI help, connected accounts, and notifications in one place. You can change your choices anytime.</p>
      <Link className="inline-flex min-h-11 items-center underline" to="/profile">Back to My Profile</Link>
    </header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Permission categories">
      {[
        ["ai","AI Assistance"],["platforms","Connected platforms"],["marketing","Optional marketing"],["supporter-updates","Supporter updates"],["documents","Campaign documents"]
      ].map(([id,label])=><button key={id} type="button" onClick={()=>setOpen(id)} aria-pressed={open===id} className={`ifund-interactive min-h-11 rounded-xl border px-4 font-semibold ${open===id ? "border-primary bg-primary/10" : "border-border"}`}>{label}</button>)}
    </div>
    {open==="ai" && <AIPermissionPreferences />}
    {open==="platforms" && <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Connect your accounts and manage their permissions here. Connecting an account does not give iFund permission to publish for you.</p>
      <Connections/>
    </div>}
    {open==="marketing" && <MarketingPreferences/>}
    {open==="supporter-updates" && <CommunicationPreferences/>}
    {open==="documents" && <CampaignDocumentPermissions/>}
    <p className="text-sm text-muted-foreground">Revoking an iFund preference cannot revoke permissions you granted directly at an external provider; disconnect the account here and check the provider's settings to revoke its authorization.</p>
  </div>;
}
