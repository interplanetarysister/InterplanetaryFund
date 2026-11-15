import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AIPermissionPreferences from "@/components/permissions/AIPermissionPreferences";
import MarketingPreferences from "./MarketingPreferences";
import Connections from "./Connections";

export default function ManagePermissions() {
  const location = useLocation();
  const [open,setOpen] = useState(location.pathname === "/connections" ? "platforms" : new URLSearchParams(location.search).get("section") === "marketing" ? "marketing" : "ai");
  return <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header className="space-y-2">
      <p className="text-sm font-semibold text-primary">My Account / My Profile</p>
      <h1 className="font-display text-3xl font-bold">Manage iFund Permissions</h1>
      <p className="text-muted-foreground">One place to review your AI preferences, optional communications, and third-party account authorizations. Unfinished integrations cannot receive permission in advance; you will be asked again when they are ready.</p>
      <Link className="inline-flex min-h-11 items-center underline" to="/profile">Back to My Profile</Link>
    </header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Permission categories">
      {[
        ["ai","AI assistance"],["platforms","Connected platforms"],["marketing","Communication"]
      ].map(([id,label])=><button key={id} type="button" onClick={()=>setOpen(id)} aria-pressed={open===id} className={`min-h-11 rounded-xl border px-4 font-semibold ${open===id ? "border-primary bg-primary/10" : "border-border"}`}>{label}</button>)}
    </div>
    {open==="ai" && <AIPermissionPreferences />}
    {open==="platforms" && <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Connections and actual provider authorization are managed here. A connected identity is not automatically a publishing grant.</p>
      <Connections/>
    </div>}
    {open==="marketing" && <MarketingPreferences/>}
    <p className="text-sm text-muted-foreground">Revoking an iFund preference cannot revoke permissions you granted directly at an external provider; disconnect the account here and check the provider's settings to revoke its authorization.</p>
  </div>;
}
