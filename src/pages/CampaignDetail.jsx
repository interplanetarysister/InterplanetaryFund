import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, Share2 } from "lucide-react";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

const PUBLIC_CAMPAIGN_COLUMNS =
  "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";

function Detail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [followId, setFollowId] = useState(null);
  const [followState, setFollowState] = useState("loading");
  const [followBusy, setFollowBusy] = useState(false);
  const [followMessage, setFollowMessage] = useState("");
  useEffect(() => {
    if (!db) { setError("Campaign data is not configured."); return; }
    db.from("ifund_campaigns")
      .select(PUBLIC_CAMPAIGN_COLUMNS)
      .eq("id", id)
      .single()
      .then(({ data, error: e }) => {
        setC(data);
        setError(e?.message || "");
      }).catch(() => setError("Campaign could not be loaded."));
  }, [id]);
  useEffect(() => {
    let live = true;
    if (!db) {setFollowState("unavailable");return;}
    db.auth.getUser().then(async ({data}) => {
      if(!live) return;
      const account = data?.user || null;
      setUser(account);
      if(!account) {setFollowState("signed-out");return;}
      const {data:follow,error:followError} = await db.from("ifund_follows").select("id").eq("owner_id",account.id).eq("campaign_id",id).maybeSingle();
      if(!live) return;
      if(followError) {setFollowState("unavailable");return;}
      setFollowId(follow?.id || null);setFollowState("ready");
    }).catch(() => {if(live) setFollowState("unavailable");});
    return () => {live=false;};
  },[id]);
  async function toggleFollow() {
    if (!db || !user || followBusy || followState!=="ready") return;
    setFollowBusy(true);setFollowMessage("");
    try {
      if(followId) {
        const {error:e} = await db.from("ifund_follows").delete().eq("id",followId).eq("owner_id",user.id);
        if(e) throw e;
        setFollowId(null);setFollowMessage("Campaign removed from your followed causes.");
      } else {
        const {data,error:e} = await db.from("ifund_follows").insert({owner_id:user.id,campaign_id:id}).select("id").single();
        if(e) throw e;
        setFollowId(data.id);setFollowMessage("Campaign added to your followed causes.");
      }
    } catch {setFollowMessage("Could not update following. This feature may still be awaiting activation.");}
    finally {setFollowBusy(false);}
  }
  return (
    <main>
      <Message error>{error}</Message>
      {!c ? (
        error ? <p role="status">This campaign is unavailable. <Link to="/discover">Explore other campaigns</Link>.</p> : <Loading />
      ) : (
        <article className="detail">
          <small>
            {c.category} · {c.status}
          </small>
          <h1>{c.title}</h1>
          <div className="actions ifund-campaign-actions">
            {followState==="ready" && <button type="button" disabled={followBusy} onClick={toggleFollow} aria-pressed={Boolean(followId)}><Heart size={18} aria-hidden="true"/>{followBusy ? "Saving…" : followId ? "Following — Unfollow" : "Follow this campaign"}</button>}
            {followState==="signed-out" && <Link to="/login">Sign in to follow</Link>}
            <button type="button" onClick={() => {if(navigator.share) navigator.share({title:c.title,url:window.location.href}).catch(()=>{}); else if(navigator.clipboard) navigator.clipboard.writeText(window.location.href).then(()=>setFollowMessage("Campaign link copied.")).catch(()=>setFollowMessage("Could not copy link."));}}><Share2 size={18} aria-hidden="true"/> Share campaign</button>
            <Link to="/following">Orbiting Causes</Link>
          </div>
          {followMessage && <p role="status">{followMessage}</p>}
          {c.cover_image_url && (
            <img
              className="cover"
              src={c.cover_image_url}
              alt="Campaign cover"
            />
          )}
          <p className="lede">{c.summary}</p>
          <div className="card">
            <h3>Funding goal</h3>
            <strong>${Number(c.goal_amount || 0).toLocaleString()}</strong>
            <p>
              Contribute through a verified payment destination when one is
              connected. This preview does not process payments.
            </p>
          </div>
          <p className="story">{c.story}</p>
        </article>
      )}
    </main>
  );
}
export default Detail;
