import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";

function Status({ children }) { return <p className="ifund-route-notice" role="status">{children}</p>; }
function Panel({ title, children }) { return <section className="card ifund-restored-card"><h2>{title}</h2>{children}</section>; }
function Dashboard({ user }) {
  const [state, setState] = useState({ loading: true, rows: [], error: "" });
  useEffect(() => {
    let active = true;
    if (!user || !db) { setState({ loading: false, rows: [], error: "Account data is not connected." }); return; }
    db.from("ifund_campaigns").select("id,title,summary,status,goal_amount,updated_at")
      .eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100)
      .then(({ data, error }) => { if (active) setState({ loading: false, rows: data || [], error: error ? "Unable to load your verified campaigns." : "" }); })
      .catch(() => { if (active) setState({ loading: false, rows: [], error: "Campaign data could not be reached." }); });
    return () => { active = false; };
  }, [user]);
  return <main className="stack">
    <div className="ifund-page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Your Interplanetary Fund</h1><p>Plan and organize your campaigns in one place.</p></div><Link className="primary" to="/create">New campaign</Link></div>
    <div className="ifund-page-grid"><Panel title="Your campaigns">{state.loading ? <p>Loading…</p> : state.error ? <Status>{state.error}</Status> : <><strong>{state.rows.length} independent records</strong><p>Only campaigns attached to your verified account appear here.</p></>}</Panel>
    <Panel title="Account"><p>Review your profile, connected platforms and onboarding.</p><Link to="/profile">Open profile</Link></Panel></div>
    <Panel title="Recent campaigns">{state.error ? <Status>{state.error}</Status> : state.rows.length ? <ul>{state.rows.map(c => <li key={c.id}><Link to={`/edit/${c.id}`}>{c.title || "Untitled"}</Link> · {c.status}</li>)}</ul> : !state.loading ? <p>No campaigns associated with this independent account yet. Historical campaigns are not automatically imported.</p> : <p>Loading campaigns…</p>}</Panel>
    <Status>Donations, supporters, settled balances and AI task counts are deliberately omitted until provider and ledger reconciliation is complete.</Status>
  </main>;
}
function Profile({ user }) {
  const [state, setState] = useState({ loading: true, error: "", message: "", handle: "", display_name: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    if (!db || !user) { setState(x => ({ ...x, loading: false, error: "You need a verified independent session." })); return; }
    db.from("ifund_profiles").select("handle,display_name").eq("id", user.id).maybeSingle().then(({ data, error }) => {
      if (active) setState({ loading: false, handle: data?.handle || "", display_name: data?.display_name || "", error: error ? "Your profile could not be loaded." : "", message: "" });
    }).catch(() => { if (active) setState(x => ({ ...x, loading: false, error: "Profile service unavailable." })); });
    return () => { active = false; };
  }, [user]);
  async function save(event) {
    event.preventDefault();
    if (!db || !user || saving || state.error) return;
    if (state.handle && !/^[A-Za-z0-9_-]{3,32}$/.test(state.handle)) {
      setState(x => ({ ...x, message: "Screen names must be 3–32 characters: letters, numbers, underscores or dashes." }));
      return;
    }
    setSaving(true);
    setState(x => ({ ...x, message: "" }));
    try {
      const { error } = await db.from("ifund_profiles").upsert({ id: user.id, handle: state.handle || null, display_name: state.display_name.slice(0,100) }, { onConflict: "id" });
      if (error) throw error;
      const { data, error: readError } = await db.from("ifund_profiles").select("handle,display_name").eq("id", user.id).single();
      if (readError || data?.handle !== (state.handle || null) || data?.display_name !== state.display_name.slice(0,100)) throw new Error("Write could not be verified");
      setState(x => ({ ...x, message: "Profile saved and verified.", handle: data.handle || "", display_name: data.display_name || "" }));
    } catch {
      setState(x => ({ ...x, message: "Profile changes were not verified. Please retry after account setup is complete." }));
    } finally { setSaving(false); }
  }
  return <main className="stack"><h1>Your profile</h1><Panel title="Account details"><p>Signed in as {user?.email || "Independent IFund member"}</p>
    {state.loading ? <p>Loading…</p> : state.error ? <Status>{state.error}</Status> : <form className="form" onSubmit={save}>
      <label>Screen name <input maxLength={32} value={state.handle} onChange={e => setState(x => ({ ...x, handle: e.target.value }))} placeholder="your_handle" /></label>
      <label>Display name <input maxLength={100} value={state.display_name} onChange={e => setState(x => ({ ...x, display_name: e.target.value }))} /></label>
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
      {state.message && <Status>{state.message}</Status>}</form>}
    </Panel><Link to="/connections">Connected platforms</Link></main>;
}
const messages = {
  "/giving": ["Your giving history", "Confirmed gifts must come from validated PayPal events and a reconciled independent ledger. No balance or donation records are inferred from the old app.", "/discover", "Find a cause"],
  "/communications": ["Campaign communications", "Messaging and audience outreach require migrated conversations, recipient consent and permission-controlled delivery. Messages cannot currently be sent.", "/inbox", "Open inbox"],
  "/mission": ["Mission Control", "Your planning space includes campaigns, connections and the AI team. Background jobs and the Chief of Staff need an independent task runtime before execution can resume.", "/dashboard", "Review campaigns"],
  "/ai-images": ["AI Image Studio", "Independent generation, licensing, uploaded-image watermarking and the paid watermark-removal policy require a verified media service. No AI images are generated on this page.", "/create", "Create a campaign"],
  "/institutions": ["Institutions", "The source institution catalog has not been authorized for public publication in this independent database. It cannot safely be reconstructed from private snapshots.", "/discover", "Discover campaigns"],
  "/institutions/:id": ["Institution profile", "The requested institution is not yet present in verified independent records.", "/institutions", "Institutions"],
  "/my-blog": ["My blog", "Your articles and draft publishing workflow need independent ownership and content storage. No drafts have been migrated into public view.", "/blogs", "Stories and blogs"],
  "/devices": ["Connected devices", "Device registrations and activation approvals are not migrated. No devices or sessions are represented as connected without independent verification.", "/connections", "Connections"],
  "/inbox": ["Inbox", "The private inbox requires message records, authorization and delivery confirmation. Email routing alone is not proof that messages are available here.", "/communications", "Communications"],
  "/following": ["Followed campaigns", "Your follow list has not been reconciled with the independent account. No followed campaigns are assumed.", "/discover", "Discover"],
  "/notifications": ["Notifications", "Notification delivery and preferences require migrated recipient records and authorization. No synthetic unread counts are displayed.", "/dashboard", "Dashboard"],
  "/donors": ["Supporters", "Supporter identity and giving totals must be verified against provider events and access policies before any private list is displayed.", "/mine", "My campaigns"],
  "/ledger": ["Financial ledger", "Only reconciled provider-authoritative ledger entries and custody movements can be displayed. This page does not assume the absence of money when the ledger service is missing.", "/mine", "My campaigns"],
  "/subscriptions": ["Membership plans", "Current plans and their billing authority must be verified against the designated PayPal merchant and billing plan identifiers. No subscription charge is initiated here.", "/profile", "Profile"],
  "/withdrawals": ["Withdrawals", "Requests remain disabled until balances, fee rules, owner eligibility, PayPal Payouts entitlement and idempotent disbursement are independently verified.", "/ledger", "Financial ledger"],
  "/agents": ["Your AI team", "Specialist agents, Chief of Staff dispatch, saved context, approval rules and execution logs must be ported independently. No mock AI answers or jobs are substituted.", "/mission", "Mission Control"],
};
const adminPages = {
  "/ops": "Workflow audit events, queues and execution controls must be verified against private IFund operations data.",
  "/platform": "Production-wide settings require a dedicated admin API with audited, server-verified authorization.",
  "/analytics": "Donation, campaign and traffic metrics are unavailable until their independent reporting sources are reconciled.",
  "/admin/external-accounts": "Provider credentials belong in server secrets; private accounts cannot be inferred from source configuration names.",
  "/admin/integrations": "OAuth consent, webhook signatures and end-to-end provider sync need independent backend validation.",
  "/admin/audit": "Audited event entries cannot be fabricated or shown without per-role access to the independent immutable log.",
  "/admin/agent-api": "Agent token issuance and rotation require a server-authenticated, scoped integration service.",
  "/admin/sustainability": "Impact reports cannot be displayed without traceable source measurements.",
  "/admin/help": "Help article editing requires audited content storage and reviewed publish permissions.",
  "/admin/founding-members": "Founding-member records require verified consent and protected waitlist storage.",
  "/admin/organization-mail": "Organizational inbox access requires independent member authorization; raw mail is never fetched through browser service keys.",
};
export default function RestoredMember({ page, user }) {
  if (page.kind === "dashboard") return <Dashboard user={user} />;
  if (page.kind === "profile") return <Profile user={user} />;
  if (page.kind === "onboarding") return <main className="stack"><h1>Get started with IFund</h1>
    <p>Complete the independent account setup without activating unverified providers.</p>
    <div className="ifund-page-grid"><Panel title="1. Profile"><p>Choose your screen name and display name.</p><Link to="/profile">Edit profile</Link></Panel>
    <Panel title="2. Connections"><p>See exactly which services are independently verified.</p><Link to="/connections">Review connections</Link></Panel>
    <Panel title="3. First campaign"><p>Create a draft for your funding idea.</p><Link to="/create">Create a draft</Link></Panel></div>
    <Status>AI automation and on-behalf publishing are not activated by visiting this page.</Status>
  </main>;
  if (page.access === "admin") return <main className="stack"><p className="eyebrow">ADMINISTRATION</p><h1>{page.title}</h1><Panel title="Verification required"><Status>{adminPages[page.path] || "Administrative data is not yet independently available."}</Status><p>Administrative controls remain disabled until their server-side authorization, audit log and data parity have been tested.</p></Panel><Link to="/dashboard">Your dashboard</Link></main>;
  const [title, description, href, action] = messages[page.path] || [
    page.title, "This content needs an independent data model, ownership permissions and verified storage before it can be used.", "/dashboard", "Dashboard",
  ];
  return <main className="stack"><p className="eyebrow">YOUR IFUND WORKSPACE</p><h1>{title}</h1><Panel title="Current availability"><Status>{description}</Status></Panel><Link className="secondary" to={href}>{action}</Link></main>;
}
