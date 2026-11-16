import {Link} from "react-router-dom";

// Offer only routes backed by real, owner-gated pages. The launcher never
// executes a specialist action or promises unverified service capabilities.
export default function AgentFeatureLauncher({campaignId,disabled=false}){
  if(!campaignId)return <section aria-label="Campaign agent tools" className="rounded-xl border border-border p-4">
    <h2 className="font-semibold">Campaign assistants</h2>
    <p className="mt-1 text-sm text-muted-foreground">Save your private campaign with a verified account before connecting its details to your iFund team.</p>
  </section>;
  const encoded=encodeURIComponent(campaignId);
  const tools=[
    {name:"Campaign writing and agent team",href:"/agents?campaign="+encoded,note:"Review owner-scoped writing requests and available specialists"},
    {name:"Campaign strategy",href:"/strategy?campaign="+encoded,note:"Plan milestones and outreach before publishing"},
    {name:"Communications drafts",href:"/communications?campaign="+encoded,note:"Prepare messages for review; nothing is automatically sent"},
    {name:"Connected platforms",href:"/permissions?section=platforms",note:"Review connections and consent in My Account"},
  ];
  return <section aria-label="Campaign agent tools" className="rounded-xl border border-border bg-card p-4">
    <h2 className="font-semibold">Continue with your iFund agent team</h2>
    <p className="mt-1 text-sm text-muted-foreground">Your saved campaign can be used as context in supported agent workspaces. Opening a workspace never approves public posting or financial actions.</p>
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {tools.map(tool=><li key={tool.name}>
        <Link to={tool.href} aria-disabled={disabled} tabIndex={disabled?-1:undefined}
          onClick={event=>{if(disabled)event.preventDefault();}}
          className={"block rounded-lg border border-border px-3 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 "+(disabled?"pointer-events-none opacity-50":"hover:bg-accent")}>
          <strong>{tool.name}</strong>
          <span className="mt-1 block text-xs text-muted-foreground">{tool.note}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
