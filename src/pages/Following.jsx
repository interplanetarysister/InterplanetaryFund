import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, RefreshCw } from "lucide-react";
import { db } from "../lib/supabase";
import { CampaignCard } from "../components/UI";

export default function Following({ user }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(null);
  const load = async () => {
    if (!db || !user?.id) { setState("unavailable"); return; }
    setState("loading");
    try {
      const { data, error } = await db.from("ifund_follows").select("id,campaign_id,pinned,created_at").eq("owner_id",user.id).order("created_at",{ascending:false}).limit(100);
      if (error) throw error;
      const ids = (data || []).map(x => x.campaign_id);
      if (!ids.length) { setItems([]); setState("ready"); return; }
      const result = await db.from("ifund_campaigns").select("id,title,summary,story,category,goal_amount,cover_image_url,status,created_at").in("id",ids).eq("status","active");
      if (result.error) throw result.error;
      const byId = new Map((result.data || []).map(c => [c.id,c]));
      setItems((data || []).filter(f => byId.has(f.campaign_id)).map(f => ({...f,campaign:byId.get(f.campaign_id)})));
      setState("ready"); setMessage("");
    } catch { setState("unavailable"); setMessage("Followed campaigns are not available yet. The follow database migration may still be pending."); }
  };
  useEffect(() => { load(); }, [user?.id]);
  const unfollow = async item => {
    if (!db || busy) return;
    setBusy(item.id); setMessage("");
    try {
      const {error} = await db.from("ifund_follows").delete().eq("id",item.id).eq("owner_id",user.id);
      if(error) throw error;
      setItems(current => current.filter(f => f.id !== item.id));
    } catch {setMessage("Could not unfollow this campaign. Please try again.");}
    finally {setBusy(null);}
  };
  return <main className="ifund-following">
    <section className="ifund-workspace-hero"><Heart size={30} aria-hidden="true"/><p className="eyebrow">YOUR SUPPORTED UNIVERSE</p><h1>Orbiting Causes</h1><p>See the active fundraising missions you follow. Keep track of causes that matter to you.</p></section>
    <div className="actions"><Link to="/discover">Explore campaigns</Link><button type="button" onClick={load} disabled={state==="loading"}><RefreshCw size={17} aria-hidden="true"/> Refresh</button></div>
    {message && <p role="status">{message}</p>}
    {state==="loading" && <p role="status">Loading followed campaigns…</p>}
    {state==="unavailable" && <section className="card"><h2>Following is not connected yet</h2><p>Your campaigns will appear here when the follow service is enabled.</p></section>}
    {state==="ready" && items.length===0 && <section className="card"><h2>No followed campaigns yet</h2><p>Discover a campaign you care about and follow it to see it here.</p><Link to="/discover">Find a cause</Link></section>}
    {state==="ready" && items.length>0 && <div className="cards">{items.map(item=><div key={item.id} className="ifund-following-card"><CampaignCard c={item.campaign}/><button type="button" disabled={busy!==null} onClick={()=>unfollow(item)}>{busy===item.id?"Removing…":"Unfollow campaign"}</button></div>)}</div>}
  </main>;
}
