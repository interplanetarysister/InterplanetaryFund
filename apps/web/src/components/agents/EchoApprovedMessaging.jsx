import {useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";

/** ECHO consent-only in-app notification delivery. Never email or cross-post. */
export default function EchoApprovedMessaging({campaignId,campaignStatus,message}) {
 const [approved,setApproved]=useState(false);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [history,setHistory]=useState({phase:"loading",rows:[],error:""});
 const [refresh,setRefresh]=useState(0);
 const attempt=useRef(null);
 useEffect(()=>{
  attempt.current=null;setApproved(false);setNotice("");
 },[campaignId,message]);
 useEffect(()=>{
  let alive=true;
  setHistory({phase:"loading",rows:[],error:""});
  authClient().rpc("ifund_my_echo_inapp_deliveries").then(({data,error})=>{
   if(!alive)return;
   if(error||!Array.isArray(data))throw new Error("Delivery history could not be verified.");
   setHistory({phase:"ready",rows:data,error:""});
  }).catch(error=>{if(alive)setHistory({phase:"error",rows:[],error:error.message||"Unavailable"});});
  return ()=>{alive=false};
 },[refresh]);
 const ready=Boolean(campaignId&&campaignStatus==="active"&&message?.trim().length>=20&&message?.trim().length<=1000);
 async function send(){
  if(busy||!approved||!ready)return;
  setBusy(true);setNotice("");
  try{
   if(!attempt.current)attempt.current=crypto.randomUUID();
   const client=authClient();
   const before=await client.auth.getUser();
   if(before.error||!before.data?.user?.id)throw new Error("Confirmed member sign-in required.");
   const {data,error}=await client.rpc("ifund_echo_send_opted_in_update",{
    p_campaign_id:campaignId,p_body:message.trim(),p_request_id:attempt.current,
   });
   if(error||!Array.isArray(data)||data.length!==1)throw new Error(error?.message||"Delivery receipt unavailable; retry with same message before sending another.");
   const after=await client.auth.getUser();
   if(after.error||after.data?.user?.id!==before.data.user.id)throw new Error("Your session changed. Verify delivery history.");
   const count=data[0].notifications_recorded;
   if(!Number.isSafeInteger(count)||count<0)throw new Error("Notification count could not be verified.");
   if(count===0){setNotice("No followers have separately opted in; nothing was sent.");}
   else {setNotice(count+" in-app update notification"+(count===1?" was":"s were")+" recorded. Email/social delivery was not attempted.");}
   setApproved(false);attempt.current=null;setRefresh(x=>x+1);
  }catch(error){setNotice(error.message||"Delivery not confirmed.");}
  finally{setBusy(false)}
 }
 return <section aria-label="ECHO opt-in in-app campaign messaging" className="space-y-3 rounded-xl border border-border bg-card p-4">
  <h2 className="font-semibold">ECHO · Approved in-app campaign updates</h2>
  <p className="text-xs text-muted-foreground">Send your reviewed message only to followers who explicitly opted into marketing updates. Maximum 50 eligible recipients and one update per campaign every 24 hours. No email or social message is sent.</p>
  {!ready&&<p className="text-sm text-muted-foreground">Choose an active owned campaign and prepare a message of 20–1,000 characters to enable sending.</p>}
  <label className="flex items-start gap-2 text-sm">
   <input type="checkbox" checked={approved} disabled={!ready||busy} onChange={e=>setApproved(e.target.checked)} className="mt-1"/>
   <span>I have reviewed this message, confirmed its accuracy and authorize in-app delivery to opted-in followers only.</span>
  </label>
  <button type="button" onClick={send} disabled={!ready||!approved||busy}
   className="min-h-11 rounded-lg border border-cyan-600 px-4 font-semibold disabled:opacity-40">
   {busy?"Verifying delivery…":"Send approved in-app update"}
  </button>
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {history.phase==="loading"&&<p role="status" className="text-xs">Loading verified message receipts…</p>}
  {history.phase==="error"&&<p role="alert" className="text-xs">{history.error}</p>}
  {history.phase==="ready"&&<div>
   <h3 className="text-sm font-semibold">Recorded in-app deliveries</h3>
   {history.rows.length===0?<p className="text-xs text-muted-foreground">No successful notification batches recorded.</p>:
    <ul className="mt-2 space-y-2">{history.rows.slice(0,10).map(row=><li key={row.delivery_id} className="text-xs">
     {new Date(row.created_at).toLocaleString()} · {row.recipient_count} notifications recorded
    </li>)}</ul>}
  </div>}
 </section>;
}
