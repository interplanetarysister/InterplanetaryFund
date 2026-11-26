import {useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {listMyStoredCovers,deleteCampaignCover} from "@/api/campaignMedia";

const button="ifund-interactive min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50";
export default function StoredCoverLibrary(){
 const [items,setItems]=useState([]),[offset,setOffset]=useState(0),[next,setNext]=useState(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const generation=useRef(0),closed=useRef(false);
 async function load(page=0){
  const ticket=++generation.current;
  setLoading(true);setError("");
  try{
   const data=await listMyStoredCovers(authClient(),{offset:page});
   if(closed.current||ticket!==generation.current)return;
   setItems(data.items);setOffset(page);setNext(data.nextOffset);
  }catch(e){
   if(!closed.current&&ticket===generation.current){
    setItems([]);setNext(null);
    setError(e?.message||"Your stored public covers could not be loaded.");
   }
  }finally{if(!closed.current&&ticket===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  closed.current=false;void load(0);
  const {data}=authClient().auth.onAuthStateChange(()=>{
   generation.current++;setItems([]);setNext(null);setNotice("");
   void load(0);
  });
  return()=>{closed.current=true;generation.current++;data?.subscription?.unsubscribe();};
 },[]);
 async function remove(item){
  if(busy||loading)return;
  if(!window.confirm("Permanently delete this public cover from R2? Any campaign still using the cover must be updated first."))return;
  const ticket=generation.current;
  setBusy(true);setError("");setNotice("");
  try{
   await deleteCampaignCover(authClient(),item.url);
   if(closed.current||ticket!==generation.current)return;
   await load(offset);
   if(!closed.current&&generation.current===ticket+1)
    setNotice("This saved public cover was deleted and its storage quota released.");
  }catch(e){if(!closed.current&&ticket===generation.current)setError(e.message||"Cover deletion could not be verified.");}
  finally{if(!closed.current)setBusy(false);}
 }
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Stored public covers">
  <div>
   <h2 className="text-xl font-semibold">Saved public covers</h2>
   <p className="mt-2 text-sm text-muted-foreground">These are public campaign-cover images you uploaded to iFund and can access from other devices. They are separate from your private media files. A cover still used by a campaign cannot be deleted until you remove or replace it there.</p>
  </div>
  <button type="button" className={button} disabled={loading||busy} onClick={()=>void load(offset)}>Refresh covers</button>
  {loading&&<p role="status">Loading saved covers…</p>}
  {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {!loading&&!error&&items.length===0&&<p className="text-sm text-muted-foreground">No registered cover uploads on this page. Older legacy images may not appear until a verified storage migration is completed.</p>}
  <ul className="grid gap-3 sm:grid-cols-2">
   {items.map(row=><li key={row.url} className="space-y-3 rounded-xl border border-border p-3">
    <img src={row.url} alt="Stored campaign cover" loading="lazy" className="aspect-video w-full rounded-lg object-cover"/>
    <p className="text-xs text-muted-foreground">{(row.bytes/1048576).toFixed(2)} MB · {row.created_at?new Date(row.created_at).toLocaleDateString():"Saved cover"}</p>
    <div className="flex flex-wrap gap-2">
     <button type="button" className={button} disabled={busy} onClick={()=>{
      navigator.clipboard?.writeText(row.url).then(()=>setNotice("Cover link copied.")).catch(()=>setError("Copy is unavailable."));
     }}>Copy cover link</button>
     <button type="button" className={button} disabled={busy} onClick={()=>void remove(row)}>Delete stored cover</button>
    </div>
   </li>)}
  </ul>
  <div className="flex gap-3">
   <button type="button" className={button} disabled={loading||busy||offset===0} onClick={()=>void load(Math.max(0,offset-50))}>Previous covers</button>
   <button type="button" className={button} disabled={loading||busy||next===null} onClick={()=>void load(next)}>Next covers</button>
  </div>
 </section>;
}
