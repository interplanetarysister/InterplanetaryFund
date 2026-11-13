import {useEffect,useState} from "react";
import {authClient} from "@/api/auth";

/** User-owned voice preference. No model inference or campaign mutation until explicit Apply. */
export default function StoryVoicePreferences({onApply,disabled=false}) {
 const [state,setState]=useState({phase:"loading",text:"",error:""});
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  setState({phase:"loading",text:"",error:""});
  authClient().rpc("ifund_my_story_voice_preferences").then(({data,error})=>{
   if(!active)return;
   if(error||!Array.isArray(data))throw new Error("Voice preferences are unavailable.");
   setState({phase:"ready",text:data[0]?.voice_instructions||"",error:""});
  }).catch(e=>{if(active)setState({phase:"error",text:"",error:e.message||"Unavailable"});});
  return ()=>{active=false};
 },[retry]);
 async function save(){
  const text=state.text.trim();
  if(busy||disabled||state.phase!=="ready")return;
  if(text.length<4||text.length>400){setNotice("Enter 4–400 characters describing your preferred writing style.");return;}
  setBusy(true);setNotice("");
  try{
   const {data,error}=await authClient().rpc("ifund_set_story_voice_preferences",{p_instructions:text});
   if(error||data!==true)throw new Error(error?.message||"Voice preferences were not verified.");
   setNotice("Private style preference saved. It will not be used until you select Apply.");
  }catch(e){setNotice(e.message||"Unable to save voice preference.");}
  finally{setBusy(false)}
 }
 return <section aria-label="STORY voice preferences" className="space-y-2 rounded-xl border border-border p-4">
  <h3 className="font-semibold">STORY · Saved campaign voice</h3>
  <p className="text-xs text-muted-foreground">Describe tone and style only. Never include passwords, donor identities or unverified facts. Applying adds your instructions to the editable brief; no AI request is sent automatically.</p>
  {state.phase==="loading"&&<p role="status">Loading your private voice profile…</p>}
  {state.phase==="error"&&<p role="alert">{state.error} <button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
  {state.phase==="ready"&&<>
   <label className="block text-sm">Style and tone
    <textarea maxLength={400} value={state.text} onChange={e=>setState(s=>({...s,text:e.target.value}))}
      className="mt-1 min-h-28 w-full rounded-lg border border-border bg-background p-3"
      placeholder="For example: warm, clear, respectful and direct. Avoid exaggerated urgency." />
   </label>
   <div className="flex flex-wrap gap-2">
    <button type="button" disabled={disabled||busy} onClick={save} className="min-h-11 rounded-lg border px-4 font-semibold disabled:opacity-50">Save voice preference</button>
    <button type="button" disabled={disabled||busy||state.text.trim().length<4} onClick={()=>{onApply?.(state.text.trim());setNotice("Voice preference added to your brief for review. No AI request was sent.");}}
      className="min-h-11 rounded-lg border px-4 font-semibold disabled:opacity-50">Apply to this writing brief</button>
   </div>
  </>}
  {notice&&<p role="status" className="text-xs">{notice}</p>}
 </section>;
}
