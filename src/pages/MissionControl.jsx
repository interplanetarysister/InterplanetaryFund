import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { db } from "../lib/supabase";

export default function MissionControl({user}) {
 const [campaigns,setCampaigns]=useState([]);
 const [status,setStatus]=useState("loading");
 const [error,setError]=useState("");
 const load=async()=>{
  if(!db||!user?.id){setStatus("unavailable");return;}
  setStatus("loading");
  try{
   const {data,error:e}=await db.from("ifund_campaigns").select("id,title,status,summary,created_at").eq("owner_id",user.id).order("created_at",{ascending:false}).limit(100);
   if(e)throw e;
   setCampaigns(data||[]);setStatus("ready");setError("");
  }catch{setStatus("unavailable");setError("Campaigns could not be loaded. Please try again.");}
 };
 useEffect(()=>{load();},[user?.id]);
 return <main className="ifund-mission-control">
  <section className="ifund-workspace-hero"><Rocket size={30} aria-hidden="true"/><p className="eyebrow">YOUR CAMPAIGN FLIGHT DECK</p><h1>Mission Control</h1><p>Prepare your fundraising missions, review drafts, and manage your outreach connections in one place.</p></section>
  <section className="card"><h2><ShieldCheck size={20} aria-hidden="true"/> Mission readiness</h2><p>Campaign creation and editing are available. Automated posting and provider synchronization are not active yet; nothing will be sent without a working, authorized integration.</p><div className="actions"><Link to="/create">Launch a mission</Link><Link to="/connections">Manage connections</Link><Link to="/agents">AI Command Crew</Link></div></section>
  <div className="actions"><h2>Your missions</h2><button type="button" disabled={status==="loading"} onClick={load}><RefreshCw size={17} aria-hidden="true"/> Refresh</button></div>
  {error&&<p role="alert">{error}</p>}
  {status==="loading"&&<p role="status">Loading your missions…</p>}
  {status==="unavailable"&&<p>Mission data is not available yet.</p>}
  {status==="ready"&&campaigns.length===0&&<section className="card"><h3>Ready for your first mission?</h3><p>Create a campaign draft to start planning your fundraising.</p><Link to="/create">Create a campaign</Link></section>}
  {status==="ready"&&campaigns.map(c=><article className="card" key={c.id}><h3>{c.title||"Untitled mission"}</h3><p>{c.summary||"Add a description to help people understand your cause."}</p><p>Status: <strong>{c.status}</strong></p><div className="actions"><Link to={"/edit/"+c.id}>Edit mission</Link>{c.status==="active"&&<Link to={"/campaign/"+c.id}>View public campaign</Link>}<Link to={"/inbox?campaign="+encodeURIComponent(c.id)}><Send size={16} aria-hidden="true"/> Campaign inbox</Link></div></article>)}
 </main>;
}
