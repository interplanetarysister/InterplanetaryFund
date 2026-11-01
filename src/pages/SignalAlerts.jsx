import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, RefreshCw, ShieldCheck } from "lucide-react";
import { db } from "../lib/supabase";

export default function SignalAlerts({user}) {
 const [items,setItems]=useState([]);
 const [status,setStatus]=useState("loading");
 const [error,setError]=useState("");
 const load=async()=>{
  if(!db||!user?.id){setStatus("unavailable");return;}
  setStatus("loading");
  try {
   const {data,error:e}=await db.from("ifund_notifications").select("*").eq("owner_id",user.id).limit(50);
   if(e)throw e;
   setItems(data||[]);setStatus("ready");setError("");
  }catch{setStatus("unavailable");setError("Alerts could not be loaded. Notification permissions or migrations may still be pending.");}
 };
 useEffect(()=>{load();},[user?.id]);
 return <main className="ifund-alerts">
  <section className="ifund-workspace-hero"><Bell size={30} aria-hidden="true"/><p className="eyebrow">YOUR MISSION SIGNALS</p><h1>Signal Alerts</h1><p>Review account notifications and important campaign updates.</p></section>
  <section className="card"><h2><ShieldCheck size={20} aria-hidden="true"/> Verified information only</h2><p>Alerts are shown only when retrieved from your account. External platform notifications are not yet synchronized.</p></section>
  <div className="actions"><Link to="/inbox">Signal Inbox</Link><Link to="/mission">Mission Control</Link><button type="button" disabled={status==="loading"} onClick={load}><RefreshCw size={17} aria-hidden="true"/> Refresh</button></div>
  {error&&<p role="alert">{error}</p>}
  {status==="loading"&&<p role="status">Loading alerts…</p>}
  {status==="unavailable"&&<p>Notifications are not available yet.</p>}
  {status==="ready"&&items.length===0&&<section className="card"><h2>No alerts yet</h2><p>When a verified update is available, it will appear here.</p></section>}
  {status==="ready"&&items.map(item=><article className="card" key={item.id}><h2>{String(item.title||item.type||"Account notification")}</h2>{item.body||item.message ? <p>{String(item.body||item.message)}</p>:null}{item.created_at&&<small>{new Date(item.created_at).toLocaleString()}</small>}</article>)}
 </main>;
}
