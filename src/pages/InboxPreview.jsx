import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailOpen, Search, ShieldCheck, Inbox as InboxIcon, ArrowLeft } from "lucide-react";
export default function InboxPreview() {
 const [params] = useSearchParams();
 const [tab, setTab] = useState("open");
 const [search, setSearch] = useState("");
 const campaign = params.get("campaign");
 return <main className="ifund-inbox">
  <Link className="ifund-back-link" to="/dashboard"><ArrowLeft size={16}/> Dashboard</Link>
  <div className="ifund-inbox-heading"><span className="ifund-inbox-mark"><MailOpen size={24}/></span>
    <div><h1>Signal Inbox</h1><p>One place for your campaign messages and alerts when your platforms are connected.</p></div>
  </div>
  <section className="ifund-inbox-verification"><ShieldCheck size={23}/><div><strong>Verification inbox</strong><p>Verified donor and payment activity will appear here when the corresponding integrations are available.</p></div></section>
  <div className="ifund-inbox-controls">
    <div className="ifund-inbox-tabs" role="group" aria-label="Message status">
      {["open","done","all"].map(t=><button key={t} type="button" aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==="open"?"Open":t==="done"?"Done":"All"}</button>)}
    </div>
    <label className="ifund-inbox-search"><Search size={17}/><span className="sr-only">Search inbox</span><input type="search" placeholder="Search messages…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
  </div>
  <section className="ifund-inbox-empty"><InboxIcon size={36}/><h2>No synced messages available</h2>
    <p>{campaign ? "Messages for this campaign will appear when its provider connections are available." : "Your messages and notifications will appear here after their providers are connected."}</p>
    <Link to="/connections">Manage connections</Link>
  </section>
  <p className="ifund-agent-disclaimer">Visual preview: filters are ready for the future inbox feed, but no messages are fetched, sent, marked read, or verified on this page.</p>
 </main>;
}
