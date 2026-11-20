import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSpecialistService } from "@/hooks/useSpecialistService";
import { campaignFromOwnedList } from "@/lib/agentFeatureRoutes.mjs";
import { selectedRevisions, verifiedMessagePreview } from "@/lib/specialistSession";
import { AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";

const button = "min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40";
const field = "mt-2 min-h-11 w-full rounded-lg border border-border bg-background p-3";
const rows = value => Array.isArray(value) ? value : [];
const id = () => crypto.randomUUID();
const toggle = (values, value, checked) => checked ? [...new Set([...values, value])] : values.filter(item => item !== value);

function useRequestedCampaign(requested,service,ownerId,apply) {
  const initialized=useRef(false);
  useEffect(()=>{
    if(initialized.current||service.phase!=="ready"||!Array.isArray(service.workspace?.campaigns))return;
    initialized.current=true;
    const selected=campaignFromOwnedList(requested,service.workspace.campaigns,ownerId);
    apply(selected);
  },[requested,service.phase,service.workspace,ownerId]);
  return Boolean(requested&&service.phase==="ready"&&Array.isArray(service.workspace?.campaigns)&&!campaignFromOwnedList(requested,service.workspace.campaigns,ownerId));
}
const SelectionNotice=({missing})=>missing?<p role="alert">The requested campaign is unavailable for this account. Choose one of your own campaigns to continue.</p>:null;

function ServiceStatus({ service, onReload }) {
  return <div className="space-y-3">
    {service.phase === "loading" && <p role="status">Verifying your account and saved workspace…</p>}
    {service.error && <p role="alert" className="break-words rounded-xl border border-red-500/40 p-4">{service.error}</p>}
    {service.notice && <p role="status" className="text-sm">{service.notice}</p>}
    {service.uncertain && <div className="space-y-3 rounded-xl border border-amber-500/40 p-4">
      <p>The result was interrupted. Reloading cannot prove whether a change finished. Retry the same request to retrieve its saved receipt.</p>
      <button type="button" className={button} disabled={service.busy} onClick={service.retry}>Retry same request</button>
    </div>}
    {service.phase !== "changed" && <button type="button" className={button} disabled={service.busy} onClick={() => onReload ? onReload() : service.reload()}>Reload saved records</button>}
  </div>;
}

function CampaignSelect({ campaigns, value, onChange, disabled, accountScope = false }) {
  return <label className="block text-sm font-semibold">Campaign scope
    <select className={field} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} required={!accountScope}>
      <option value="">{accountScope ? "My account only" : "Choose an owned campaign"}</option>
      {rows(campaigns).map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.title || "Untitled campaign"}</option>)}
    </select>
  </label>;
}

export function PlanningServiceWorkspace({ agent, ownerId, initialCampaignId=null }) {
  const service = useSpecialistService(agent, ownerId);
  const [objective, setObjective] = useState("Where should I focus my fundraising effort next?");
  const [campaignIds, setCampaignIds] = useState(()=>{const id=campaignFromOwnedList(initialCampaignId,service.workspace?.campaigns,ownerId);return id?[id]:[];}), [selected, setSelected] = useState([]), [review, setReview] = useState(null);
  const [validation, setValidation] = useState("");
  const missingCampaign=useRequestedCampaign(initialCampaignId,service,ownerId,id=>setCampaignIds(id?[id]:[]));
  const workspace = service.workspace;
  const recommendations = rows(workspace?.recommendations), group = recommendations.slice(0, 50);
  const locked = service.locked || !!review;
  function prepare(status) {
    try {
      const items = selectedRevisions(recommendations, selected);
      setReview({ operation_id: id(), status, items, titles: items.map(item => recommendations.find(row => row.id === item.id)?.title) });
      setValidation("");
    } catch (error) { setValidation(error.message); }
  }
  const growth = agent === "growth";
  return <section className="space-y-5" aria-label={growth ? "FORGE saved growth reports" : "POLARIS saved strategy plans"}>
    <h3 className="flex items-center gap-2 text-xl font-semibold"><AgentIdentityIcon identity={growth ? "forge" : "polaris"} size={30}/>{growth ? "Saved growth reports" : "Saved strategy plans"}</h3>
    <p className="text-sm text-muted-foreground">Review priorities and save decisions without changing campaigns or publishing content. New report generation is available only when the service verifies its AI capability.</p>
    <SelectionNotice missing={missingCampaign}/>
    <ServiceStatus service={service} onReload={() => service.reload(() => { setSelected([]); setReview(null); })}/>
    {service.phase === "changed" ? null : workspace?.access_available === false ? <p>An eligible plan is required for these saved planning tools. Your existing free related tools remain available.</p> : workspace && <>
      <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={event => {
        event.preventDefault(); if (locked || workspace.ai_available !== true || !objective.trim() || (missingCampaign&&!campaignIds.length)) return;
        const body = { request_id: id(), objective: objective.trim(), ...(campaignIds.length ? { campaign_ids: campaignIds } : {}) };
        service.mutate("brief", body, () => { setSelected([]); setReview(null); });
      }}>
        <fieldset disabled={locked} className="space-y-2">
          <legend className="font-semibold">Campaign focus</legend>
          <p className="text-sm text-muted-foreground">Choose up to 10 campaigns, or leave all unchecked for your 20 most recently updated campaigns.</p>
          {rows(workspace.campaigns).map(campaign => <label key={campaign.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={campaignIds.includes(campaign.id)} disabled={!campaignIds.includes(campaign.id) && campaignIds.length >= 10}
              onChange={event => setCampaignIds(value => toggle(value, campaign.id, event.target.checked))}/>{campaign.title || "Untitled campaign"}
          </label>)}
        </fieldset>
        <label className="block text-sm font-semibold">What would you like to decide?
          <textarea className={field} rows={4} maxLength={2000} required value={objective} disabled={locked} onChange={event => setObjective(event.target.value)}/>
        </label>
        {workspace.ai_available !== true && <p role="status" className="text-sm">New AI reports are unavailable. You can review saved records when present.</p>}
        <button className={button} disabled={locked || workspace.ai_available !== true || !objective.trim() || (missingCampaign&&!campaignIds.length)}>Prepare {growth ? "growth report" : "strategy plan"}</button>
      </form>
      {workspace.brief && <article className="space-y-4 rounded-xl border border-border p-4">
        <h4 className="font-semibold">Your saved report</h4><p className="whitespace-pre-wrap break-words">{workspace.brief.summary}</p>
        {[["Today", "today_priorities"], ["This week", "week_priorities"], ["Long term", "long_term"], ["Risks", "risks"]].map(([label, key]) => <section key={key}>
          <h5 className="font-semibold">{label}</h5><ul className="list-disc pl-5">{rows(workspace.brief[key]).map((text, index) => <li key={index} className="break-words">{text}</li>)}</ul>
        </section>)}
        {rows(workspace.brief.predictions).length > 0 && <section className="space-y-3"><h5 className="font-semibold">Hypotheses to review · estimates, not promises</h5>
          {workspace.brief.predictions.map((prediction, index) => <div key={index} className="break-words text-sm"><p>{prediction.forecast}</p><p>Evidence: {prediction.evidence}</p><p>Confidence: {prediction.confidence}</p><p>Suggested next step: {prediction.recommended_action}</p></div>)}
        </section>}
      </article>}
      <section className="space-y-3" aria-label="Saved recommendations"><h4 className="text-lg font-semibold">Recommendations</h4>
        <p className="text-sm text-muted-foreground">Accepting records a decision. It does not perform the work, contact supporters or alter financial records.</p>
        {group.length > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={group.every(row => selected.includes(row.id))} disabled={locked}
          onChange={event => setSelected(event.target.checked ? group.map(row => row.id) : [])}/>Select first {group.length} loaded recommendations</label>}
        <div className="flex flex-wrap gap-2">{[["Accept selected", "accepted"], ["Dismiss selected", "dismissed"], ["Reopen selected", "open"]].map(([label, status]) =>
          <button type="button" className={button} key={status} disabled={locked || !selected.length || selected.length > 50} onClick={() => prepare(status)}>{label}</button>)}</div>
        {validation && <p role="alert">{validation}</p>}
        {review && <section className="space-y-3 rounded-xl border border-cyan-500/50 p-4" aria-label="Review recommendation decisions">
          <p>Set these {review.items.length} recommendations to <strong>{review.status}</strong>?</p><ul className="list-disc pl-5">{review.titles.map((title, index) => <li key={index}>{title}</li>)}</ul>
          <button type="button" className={button} disabled={service.locked} onClick={() => service.mutate("bulk", { operation_id: review.operation_id, status: review.status, items: review.items }, () => { setReview(null); setSelected([]); })}>Confirm decisions</button>
          <button type="button" className={button} disabled={service.locked} onClick={() => setReview(null)}>Back to recommendations</button>
        </section>}
        {!recommendations.length && <p>No saved recommendations yet.</p>}
        {recommendations.map(row => <article key={row.id} className="space-y-2 rounded-xl border border-border p-4">
          <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" aria-label={"Select " + row.title} checked={selected.includes(row.id)} disabled={locked || (!selected.includes(row.id) && selected.length >= 50)}
            onChange={event => setSelected(value => toggle(value, row.id, event.target.checked))}/><strong className="break-words">{row.title}</strong></label>
          <p className="text-sm">{row.campaign_title} · {row.status}</p><p className="break-words">{row.description}</p>
          <details><summary className="min-h-11 cursor-pointer">Evidence and reasoning</summary><p>{row.reasoning}</p><p>Evidence: {row.evidence}</p><p>Confidence: {row.confidence}</p><p>Expected impact: {row.expected_impact}</p><p>Effort: {row.estimated_effort}</p></details>
        </article>)}
        {workspace.recommendations_truncated && <p className="text-sm">Showing the latest 100 recommendations; decisions affect only the loaded records selected above.</p>}
      </section>
    </>}
  </section>;
}

const EMPTY_MESSAGE = { message_id: null, revision: null, campaign_id: "", subject: "", content: "", comm_type: "update" };
export function CommunicationsServiceWorkspace({ ownerId, initialCampaignId=null }) {
  const service = useSpecialistService("communications", ownerId);
  const [form, setForm] = useState(()=>({...EMPTY_MESSAGE,campaign_id:campaignFromOwnedList(initialCampaignId,service.workspace?.campaigns,ownerId)})), [details, setDetails] = useState(""), [selected, setSelected] = useState([]);
  const [review, setReview] = useState(null), [validation, setValidation] = useState(""), [outcomes, setOutcomes] = useState([]);
  const preview = useRef(null);
  const missingCampaign=useRequestedCampaign(initialCampaignId,service,ownerId,id=>setForm(value=>({...value,campaign_id:id})));
  const workspace = service.workspace, messages = rows(workspace?.messages), drafts = messages.filter(message => message.status === "draft"), group = drafts.slice(0, 50);
  const locked = service.locked || !!review;
  const after = receipt => { setSelected([]); setReview(null); setForm(EMPTY_MESSAGE); preview.current = null; setOutcomes(rows(receipt.outcomes)); };
  function prepare(kind) {
    try {
      const items = selectedRevisions(drafts, selected, { max: kind === "send" ? 5 : 50 });
      setValidation("");
      if (kind === "cancel") { setReview({ kind, operation_id: id(), items, messages: items.map(item => drafts.find(row => row.id === item.id)) }); return; }
      const fingerprint = JSON.stringify(items);
      if (preview.current?.fingerprint !== fingerprint) preview.current = { fingerprint, preview_id: id() };
      service.inspect("prepare-send", { preview_id: preview.current.preview_id, items }, data => {
        const checked = verifiedMessagePreview(data, preview.current?.preview_id, items);
        setReview({ ...checked, kind: "send" });
      });
    } catch (error) { setValidation(error.message); }
  }
  return <section className="space-y-5" aria-label="ECHO saved supporter updates">
    <h3 className="flex items-center gap-2 text-xl font-semibold"><AgentIdentityIcon identity="echo" size={30}/>Saved supporter updates</h3>
    <SelectionNotice missing={missingCampaign}/>
    <p className="text-sm text-muted-foreground">Save editable messages and review exact text and eligible audiences before in-app delivery. Email, social posting and autonomous messaging are not authorized here.</p>
    <ServiceStatus service={service}/>
    {service.phase !== "changed" && workspace && <>
      <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={event => { event.preventDefault(); if (locked) return; service.mutate("save", { ...form, operation_id: id() }, after); }}>
        <h4 className="font-semibold">{form.message_id ? "Edit saved draft" : "Write a private draft"}</h4>
        <CampaignSelect campaigns={workspace.campaigns} value={form.campaign_id} disabled={locked} onChange={campaign_id => setForm(value => ({ ...value, campaign_id }))}/>
        <label className="block text-sm font-semibold">Message type<select className={field} disabled={locked} value={form.comm_type} onChange={event => setForm(value => ({ ...value, comm_type: event.target.value }))}>
          {["update", "thank_you", "announcement", "milestone", "volunteer", "sponsor"].map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
        <label className="block text-sm font-semibold">Subject<input className={field} maxLength={200} required disabled={locked} value={form.subject} onChange={event => setForm(value => ({ ...value, subject: event.target.value }))}/></label>
        <label className="block text-sm font-semibold">Message<textarea className={field} rows={6} maxLength={4000} required disabled={locked} value={form.content} onChange={event => setForm(value => ({ ...value, content: event.target.value }))}/></label>
        <button className={button} disabled={locked}>Save draft</button>
        {form.message_id && <button type="button" className={button} disabled={locked} onClick={() => setForm(EMPTY_MESSAGE)}>Write a new message</button>}
      </form>
      {workspace.ai_available === true && <section className="space-y-3 rounded-xl border border-border p-4">
        <h4 className="font-semibold">Prepare an AI-assisted draft</h4><label className="block text-sm">What should supporters know?<textarea className={field} rows={3} maxLength={2000} disabled={locked} value={details} onChange={event => setDetails(event.target.value)}/></label>
        <button type="button" className={button} disabled={locked || !form.campaign_id || !details.trim()} onClick={() => service.mutate("drafts", { request_id: id(), campaign_id: form.campaign_id, comm_type: form.comm_type, details }, receipt => { after(receipt); setDetails(""); })}>Prepare a saved draft</button>
      </section>}
      <section className="space-y-3" aria-label="Saved communications">
        <h4 className="text-lg font-semibold">Your saved messages</h4>
        {workspace.delivery_available !== true && <p role="status">In-app sending is unavailable. You can save, edit, review and cancel private drafts.</p>}
        <p className="text-sm text-muted-foreground">Up to 100 loaded messages. Review up to 5 for sending or cancel up to 50 drafts. No email is sent by these tools.</p>
        {group.length > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" disabled={locked} checked={group.every(row => selected.includes(row.id))} onChange={event => { setSelected(event.target.checked ? group.map(row => row.id) : []); preview.current = null; }}/>Select {group.length} loaded drafts</label>}
        <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={locked || !selected.length || selected.length > 5} onClick={() => prepare("send")}>Review exact messages and audience</button>
          <button type="button" className={button} disabled={locked || !selected.length || selected.length > 50} onClick={() => prepare("cancel")}>Review cancellation</button></div>
        {validation && <p role="alert">{validation}</p>}
        {review && <section className="space-y-3 rounded-xl border border-cyan-500/50 p-4" aria-label="Owner message review">
          <h5 className="font-semibold">{review.kind === "send" ? "Review these in-app updates" : "Cancel these private drafts?"}</h5>
          {rows(review.messages).map(message => <article key={message.id} className="space-y-2 border-b border-border pb-3"><strong>{message.subject}</strong>
            {review.kind === "send" && <><p className="whitespace-pre-wrap break-words">{message.content}</p><p>{message.campaign_title} · {message.eligible_recipients} eligible in-app supporters at review time</p></>}
          </article>)}
          {review.kind === "send" && <p className="text-sm">Only this reviewed audience is eligible. Later opt-outs and ineligible members are excluded again by the server. This does not send email.</p>}
          <button type="button" className={button} disabled={service.locked || (review.kind === "send" && workspace.delivery_available !== true)} onClick={() => service.mutate(review.kind === "send" ? "send" : "cancel", review.kind === "send"
            ? { preview_id: review.preview_id, confirm_owner_review: true } : { operation_id: review.operation_id, items: review.items }, after)}>{review.kind === "send" ? "Send these updates inside IFund" : "Confirm cancellation"}</button>
          <button type="button" className={button} disabled={service.locked} onClick={() => setReview(null)}>Back to drafts</button>
        </section>}
        {!messages.length && <p>No saved messages yet.</p>}
        {messages.map(message => <article key={message.id} className="space-y-3 rounded-xl border border-border p-4"><h5 className="font-semibold break-words">{message.subject}</h5>
          <p className="text-sm">{message.campaign_title} · {message.status}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>
          {message.status === "draft" && <div className="flex flex-wrap gap-3"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={locked || (!selected.includes(message.id) && selected.length >= 50)} checked={selected.includes(message.id)} onChange={event => { setSelected(value => toggle(value, message.id, event.target.checked)); preview.current = null; }}/>Select draft</label>
            <button type="button" className={button} disabled={locked} onClick={() => setForm({ message_id: message.id, revision: message.updated_at, campaign_id: message.campaign_id, subject: message.subject, content: message.content, comm_type: message.comm_type })}>Edit draft</button></div>}
        </article>)}
        {outcomes.length > 0 && <section className="rounded-xl border border-border p-4 text-sm" aria-label="Last confirmed message operation"><h5 className="font-semibold">Last confirmed operation receipts</h5>
          {outcomes.map(outcome => <p key={outcome.id}>{outcome.status === "sent_in_app" && Number.isSafeInteger(outcome.delivered)
            ? "Delivered inside IFund to " + outcome.delivered + " eligible supporters." : "Saved outcome: " + String(outcome.status || "unconfirmed")}
            {Number.isSafeInteger(outcome.excluded_since_review) && outcome.excluded_since_review > 0 ? " Excluded since review: " + outcome.excluded_since_review + "." : ""}</p>)}</section>}
      </section>
    </>}
  </section>;
}

const REQUEST_ACTIVE = new Set(["requested", "assigned", "in_progress", "waiting_user", "waiting_external", "needs_review"]);
export function ManagedConnectionsServiceWorkspace({ ownerId, initialCampaignId=null }) {
  const service = useSpecialistService("connections", ownerId);
  const [provider, setProvider] = useState(""), [campaign, setCampaign] = useState(()=>campaignFromOwnedList(initialCampaignId,service.workspace?.campaigns,ownerId)), [action, setAction] = useState("connect"), [connection, setConnection] = useState("");
  const [confirmed, setConfirmed] = useState(false), [selected, setSelected] = useState([]), [review, setReview] = useState(null), [validation, setValidation] = useState(""), [methods, setMethods] = useState(null);
  const missingCampaign=useRequestedCampaign(initialCampaignId,service,ownerId,setCampaign);
  const workspace = service.workspace, providers = rows(workspace?.providers), permissions = rows(workspace?.permissions), requests = rows(workspace?.requests), connections = rows(workspace?.connections);
  const chosen = providers.find(item => item.id === provider), locked = service.locked || !!review;
  const currentPermission = permissions.find(item => item.provider === provider && item.campaign_id === (campaign || null) && item.status === "active" && item.policy_version === workspace?.policy_version && Date.parse(item.expires_at) > Date.now());
  const clearScope = () => { setConfirmed(false); setConnection(""); setMethods(null); setValidation(""); };
  const after = () => { setSelected([]); setReview(null); setConfirmed(false); setMethods(null); };
  function prepare(kind) {
    try {
      const ids = selected.filter(value => value.startsWith(kind + ":")).map(value => value.slice(kind.length + 1));
      const source = kind === "revoke" ? permissions : requests;
      const items = selectedRevisions(source, ids, { revisionKey: "revision" });
      setReview({ operation_id: id(), kind, items, labels: items.map(item => { const row = source.find(candidate => candidate.id === item.id); return (providers.find(p => p.id === row.provider)?.name || row.provider) + " · " + (row.campaign_id ? "campaign scope" : "account scope"); }) });
      setValidation("");
    } catch (error) { setValidation(error.message); }
  }
  return <section className="space-y-5" aria-label="LINK scoped connection help">
    <SelectionNotice missing={missingCampaign}/>
    <h3 className="flex items-center gap-2 text-xl font-semibold"><AgentIdentityIcon identity="link" size={30}/>Scoped connection help</h3><p className="text-sm text-muted-foreground">Save provider-specific requests and review permissions. A saved request or public link is not provider authorization, account creation or permission to publish or move money.</p>
    <ServiceStatus service={service}/>
    {service.phase !== "changed" && workspace && <>
      <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Connection request scope">
        <label className="block text-sm font-semibold">Provider<select className={field} disabled={locked} value={provider} onChange={event => { setProvider(event.target.value); clearScope(); }}>
          <option value="">Choose a provider</option>{providers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {chosen && <>
          <div className="flex items-center gap-3">{typeof chosen.logo === "string" && /^\/platform-logos\/[a-z0-9_]+\.(?:svg|png)$/.test(chosen.logo) && <img src={chosen.logo} alt="" className="h-9 w-9 object-contain"/>}<strong>{chosen.name}</strong></div>
          <CampaignSelect campaigns={workspace.campaigns} value={campaign} disabled={locked} accountScope onChange={value => { setCampaign(value); clearScope(); }}/>
          <button type="button" className={button} disabled={locked} onClick={() => { const exact = provider; service.inspect("methods?provider=" + encodeURIComponent(exact), undefined, result => { if (result.provider === exact) setMethods(result); }); }}>Check setup guidance</button>
          {methods?.provider === provider && <p role="status" className="text-sm">{methods.message} Current setup: {methods.status}. Financial authority is not granted.</p>}
          {workspace.managed_available !== true ? <p>Your plan can review saved records, cancel requests and revoke help below. A verified eligible plan is required to request new connection assistance.</p> : <>
            {currentPermission ? <p className="text-sm">IFund help is allowed for this exact provider and scope until {new Date(currentPermission.expires_at).toLocaleDateString()}.</p> : <div className="space-y-3 rounded-xl border border-border p-3">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={locked} onChange={event => setConfirmed(event.target.checked)}/>
                Allow IFund help with {chosen.name} for this account or selected campaign for 30 days. This does not authorize publishing, payment actions, accepting provider terms or bypassing login. I can revoke this help.</label>
              <button type="button" className={button} disabled={locked || !confirmed} onClick={() => service.mutate("grant-help", { operation_id: id(), provider, campaign_id: campaign || null, policy_version: workspace.policy_version, confirmed: true }, after)}>Allow scoped IFund help</button>
            </div>}
            <label className="block text-sm font-semibold">Requested help<select className={field} value={action} disabled={locked} onChange={event => { setAction(event.target.value); setConnection(""); }}>
              {[["connect", "Connect my account"], ["create_account", "Help create an account"], ["repair", "Repair a connection"], ["reauthorize", "Renew provider permission"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {["repair", "reauthorize"].includes(action) && <label className="block text-sm font-semibold">Recorded connection<select className={field} value={connection} disabled={locked} onChange={event => setConnection(event.target.value)}>
              <option value="">Choose a recorded connection</option>{connections.filter(item => item.provider === provider).map(item => <option key={item.id} value={item.id}>{chosen.name} · {item.status}</option>)}</select></label>}
            <button type="button" className={button} disabled={locked || !currentPermission || (["repair", "reauthorize"].includes(action) && !connection)} onClick={() => service.mutate("requests", { operation_id: id(), provider, campaign_id: campaign || null, action, connection_id: connection || null }, after)}>Save help request</button>
          </>}
        </>}
      </section>
      <section className="space-y-3" aria-label="Recorded provider connections"><h4 className="font-semibold">Recorded connections</h4>
        <p className="text-sm text-muted-foreground">These records require a current provider check. Recorded status does not grant publishing or financial access.</p>
        {!connections.length && <p>No recorded connections.</p>}{connections.map(item => <p key={item.id} className="rounded-xl border border-border p-3 text-sm">{providers.find(p => p.id === item.provider)?.name || item.provider} · {item.status === "disconnected" ? "Disconnected" : "Provider verification required"}</p>)}
      </section>
      {[["revoke", "IFund help permissions", permissions], ["cancel", "Connection help requests", requests]].map(([kind, title, records]) => <section key={kind} className="space-y-3" aria-label={title}>
        <h4 className="font-semibold">{title}</h4>{!records.length && <p>No saved records.</p>}
        {records.map(row => <article key={row.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
          {(kind === "revoke" ? row.status !== "revoked" : REQUEST_ACTIVE.has(row.status)) && <input type="checkbox" className="mt-1" aria-label={"Select " + kind + " " + row.provider + " " + row.id} disabled={locked || (!selected.includes(kind + ":" + row.id) && selected.filter(item => item.startsWith(kind + ":")).length >= 50)} checked={selected.includes(kind + ":" + row.id)} onChange={event => setSelected(value => toggle(value, kind + ":" + row.id, event.target.checked))}/>}
          <div className="min-w-0 break-words text-sm"><strong>{providers.find(p => p.id === row.provider)?.name || row.provider}</strong><p>{row.status} {row.action ? "· " + row.action.replaceAll("_", " ") : ""}</p>{row.message && <p>{row.message}</p>}</div>
        </article>)}
        <button type="button" className={button} disabled={locked || !selected.some(value => value.startsWith(kind + ":"))} onClick={() => prepare(kind)}>Review selected {kind === "revoke" ? "revocations" : "cancellations"}</button>
      </section>)}
      {validation && <p role="alert">{validation}</p>}
      {review && <section className="space-y-3 rounded-xl border border-cyan-500/50 p-4" aria-label="Review scoped connection changes"><h4 className="font-semibold">{review.kind === "revoke" ? "Revoke IFund help" : "Cancel help requests"}</h4>
        <ul className="list-disc pl-5">{review.labels.map((label, index) => <li key={index}>{label}</li>)}</ul><p className="text-sm">This affects only these {review.items.length} records. It does not delete provider accounts or revoke provider-side access.</p>
        <button type="button" className={button} disabled={service.locked} onClick={() => service.mutate("change-selected", { operation_id: review.operation_id, kind: review.kind, items: review.items }, after)}>Confirm {review.kind === "revoke" ? "revocation" : "cancellation"}</button>
        <button type="button" className={button} disabled={service.locked} onClick={() => setReview(null)}>Back to connections</button>
      </section>}
    </>}
  </section>;
}

const SERVICES = { polaris: "strategy", forge: "growth", echo: "communications", link: "connections" };
export default function SpecialistServiceWorkspace({ identity, initialCampaignId=null }) {
  const { status, user } = useAuthSession();
  const agent = SERVICES[identity];
  if (!agent) return null;
  if (status === "loading") return <p role="status">Verifying your account…</p>;
  if (!user) return <p>Sign in with your confirmed account to open saved specialist tools. <Link className="underline" to="/login?returnTo=%2Fagents">Sign in</Link></p>;
  const props = { ownerId: user.id, initialCampaignId };
  const scopeKey=agent + ":" + user.id + ":" + (initialCampaignId||"account");
  return agent === "communications" ? <CommunicationsServiceWorkspace key={scopeKey} {...props}/> : agent === "connections" ? <ManagedConnectionsServiceWorkspace key={scopeKey} {...props}/> : <PlanningServiceWorkspace key={scopeKey} {...props} agent={agent}/>;
}
