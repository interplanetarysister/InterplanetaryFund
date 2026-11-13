import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { OAUTH_PLATFORM_IDS, CONNECTION_PLATFORMS } from "@/lib/connectionCatalog.mjs";

const REQUIRED_BINDINGS = [
  ["OAUTH_API_ENABLED", "Enable the member authorization gateway."],
  ["OAUTH_FRONTEND_ORIGINS", "Allow only the exact HTTPS web origins where members connect."],
  ["SUPABASE_URL", "Set the canonical Supabase project URL."],
  ["SUPABASE_PUBLISHABLE_KEY", "Bind the safe Supabase publishable key."],
  ["SUPABASE_SECRET_KEY", "Bind the server-only database key (never expose it to the frontend)."],
  ["OAUTH_ENCRYPTION_KEY", "Set a 32-byte secret for provider token storage."],
];
const PROVIDER_APPROVALS = [
  ["google","Google web client"],
  ["facebook_pages","Meta Pages authorization and approved Page permissions"],
  ["instagram","Instagram professional account authorization"],
  ["youtube","Google/YouTube account authorization"],
  ["linkedin","LinkedIn authorization and member permissions"],
  ["tiktok","TikTok authorization"],
  ["x","X user authorization"]
];
export default function AdminConnections() {
 const [status,setStatus] = useState("loading");
 const [providers,setProviders] = useState({});
 const [detail,setDetail] = useState("");
 const [reload,setReload] = useState(0);
 useEffect(()=>{
   let active=true;
   (async()=>{
     try {
       const { data,error }=await authClient().auth.getSession();
       if(error || !data?.session?.access_token) throw new Error("Authenticated session required.");
       const result=await fetch("/api/oauth/status",{
         headers:{Authorization:"Bearer "+data.session.access_token}
       });
       if(!result.ok) throw new Error("Member OAuth gateway did not pass the provider-readiness check (HTTP "+result.status+").");
       const payload=await result.json();
       if(payload.enabled!==true || payload.storage_ready!==true) throw new Error("Member authorization has not passed all storage readiness checks.");
       if(active){setProviders(payload.providers||{});setStatus("ready");setDetail("");}
     } catch(e){
       if(active){setStatus("attention");setDetail(e.message||"Readiness check unavailable.");}
     }
   })();
   return ()=>{active=false};
 },[reload]);
 const connected=Object.keys(providers).filter(name=>providers[name]===true);
 return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
  <header className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Administrator tools</p>
    <h1 className="font-display text-3xl font-bold">Connection integrations</h1>
    <p className="text-sm text-muted-foreground">Read-only readiness for member OAuth, vault storage, provider registrations, and approved publishing permissions. This page never exposes credentials or grants member consent.</p>
    <Link to="/connections" className="inline-flex min-h-11 items-center text-primary underline">Back to member Connections</Link>
  </header>
  <section className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label="Gateway status">
    <h2 className="font-semibold">Member OAuth gateway</h2>
    <p role="status" className="text-sm">{status==="loading"?"Checking current configuration…":status==="ready"?"Provider authorization gateway and encrypted storage are configured.":"Configuration requires administrator attention."}</p>
    {detail && <p role="alert" className="text-sm text-muted-foreground">{detail}</p>}
    <p className="text-xs text-muted-foreground">Configured OAuth providers: {status==="ready"?connected.length:"Unavailable"} of {PROVIDER_APPROVALS.length}. A provider appearing configured does not prove member consent or live posting privileges.</p>
    <button type="button" className="min-h-11 rounded-xl border border-border px-4 font-semibold" onClick={()=>{setStatus("loading");setReload(x=>x+1)}}>Check again</button>
  </section>
  <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
    <h2 className="font-semibold">Secure runtime requirements</h2>
    <p className="text-sm text-muted-foreground">These binding names belong in the Cloudflare Worker environment, not in the browser or Git repository. Values are never displayed here.</p>
    <ul className="space-y-2">{REQUIRED_BINDINGS.map(([name,description])=><li className="rounded-xl border border-border p-3 text-sm" key={name}>
       <code className="font-semibold">{name}</code><p className="mt-1 text-muted-foreground">{description}</p>
    </li>)}</ul>
    <p className="text-sm">Deploy the canonical <code>worker/oauth.js</code> route through the existing migration Worker and an authorized same-origin <code>/api/oauth/*</code> gateway. Preserve the Cloudflare Pages and financial release gates.</p>
  </section>
  <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
    <h2 className="font-semibold">Provider registration and consent checks</h2>
    <ul className="space-y-2">{PROVIDER_APPROVALS.map(([id,label])=><li key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
       <span>{label}</span><span className="text-muted-foreground">{status!=="ready"?"Unverified":providers[id]===true?"Configured · member test required":"Setup and approval required"}</span>
    </li>)}</ul>
    <p className="text-xs text-muted-foreground">Each provider must complete a real member sign-in and verification before it can be labeled connected. Publishing requires its own independently verified permissions and explicit user approval.</p>
  </section>
  <section className="rounded-2xl border border-border bg-card p-5 text-sm">
    <h2 className="font-semibold">Supported member-facing platform tiles</h2>
    <p className="mt-2">{CONNECTION_PLATFORMS.length} platform choices. {Object.keys(OAUTH_PLATFORM_IDS).length} supported secure-account intents; all other public pages are bookmarks or official-site guidance, not OAuth access.</p>
  </section>
 </main>;
}
