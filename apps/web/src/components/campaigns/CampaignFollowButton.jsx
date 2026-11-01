import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { authClient } from "@/api/auth";
import { isFollowingCampaign, setCampaignFollow } from "@/lib/followedCampaigns";

export default function CampaignFollowButton({ campaignId, status }){
  const [state,setState]=useState({phase:"loading",following:false});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let mounted=true;
    setError("");
    setState({phase:"loading",following:false});
    (async()=>{
      try {
        const client=authClient();
        const {data,error:authError}=await client.auth.getUser();
        if(authError || !data?.user){
          if(mounted)setState({phase:"anonymous",following:false});
          return;
        }
        const following=await isFollowingCampaign(client,campaignId);
        if(mounted)setState({phase:"ready",following});
      }catch {
        if(mounted)setState({phase:"error",following:false});
      }
    })();
    return()=>{mounted=false;};
  },[campaignId]);
  if(status!=="active")return null;
  if(state.phase==="anonymous")return <Link
    to={"/login?returnTo="+encodeURIComponent("/campaign/"+campaignId)}
    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold">
    <Heart className="h-4 w-4" aria-hidden="true"/>Sign in to follow
  </Link>;
  if(state.phase==="loading")return <p role="status" className="text-sm">Checking follow status…</p>;
  if(state.phase==="error")return <p role="alert" className="text-sm text-muted-foreground">
    Following is temporarily unavailable; your previous preferences were not changed.
  </p>;
  async function change(){
    if(busy)return;
    setBusy(true);setError("");
    try{
      const result=await setCampaignFollow(authClient(),campaignId,!state.following);
      setState({phase:"ready",following:result===true});
    }catch(cause){
      setError(cause?.message||"Follow update was not confirmed.");
    }finally{setBusy(false);}
  }
  return <div className="space-y-2">
    <button type="button" onClick={change} disabled={busy} aria-pressed={state.following}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold disabled:opacity-50">
      <Heart aria-hidden="true" className={"h-4 w-4 "+(state.following?"fill-current":"")}/>
      {busy?"Saving…":state.following?"Following · Unfollow":"Follow this campaign"}
    </button>
    {state.following&&<p className="text-xs"><Link to="/following" className="underline">Manage notification preferences</Link></p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
