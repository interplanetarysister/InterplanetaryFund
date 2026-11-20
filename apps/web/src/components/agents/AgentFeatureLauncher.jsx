import { Link } from 'react-router-dom';
import { AGENT_FEATURES, agentWorkspaceHref, agentToolHref, validCampaignSelection } from '../../lib/agentFeatureRoutes.mjs';

/** Navigation to real owner-checked workspaces; never starts an external action. */
export default function AgentFeatureLauncher({campaignId=null,disabled=false,onSelect,title='Your campaign team'}){
 const saved=validCampaignSelection(campaignId);
 return <section className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-label="Campaign agent features">
  <h2 className="text-xl font-semibold">{title}</h2>
  <p className="text-sm text-muted-foreground">{saved?'Choose a specialist for your saved campaign.':'Choose a preparation tool. Save a draft to carry your campaign into its workspace.'}</p>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{AGENT_FEATURES.map(agent=><article key={agent.identity} className="space-y-2 rounded-xl border border-border p-3">
   <h3 className="font-semibold">{agent.name}</h3><p className="text-sm text-muted-foreground">{agent.tool}</p>
   {onSelect?<button type="button" disabled={disabled} onClick={()=>onSelect(agent.identity)} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50">Open {agent.name}</button>:
    disabled?<span className="inline-flex min-h-11 items-center text-sm text-muted-foreground">Finish saving to open {agent.name}</span>:
    <Link className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold" to={agentWorkspaceHref(agent.identity,saved)}>Open {agent.name}</Link>}
   {!disabled&&<Link className="inline-flex min-h-11 items-center text-sm underline" to={agentToolHref(agent.identity,saved)}>Open {agent.tool}</Link>}
  </article>)}</div>
 </section>;
}
