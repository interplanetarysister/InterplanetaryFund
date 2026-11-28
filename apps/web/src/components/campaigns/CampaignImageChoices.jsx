import {useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {decodeGeneratedArtwork} from "@/lib/imageArtwork.mjs";
import {overlayExactArtworkCaption} from "@/lib/exactArtworkCaption.mjs";
import {uploadCampaignCover} from "@/api/campaignCovers";
import {suggestCaption} from "@/api/captionSuggestions";

const STYLES=[["interstellar","Interstellar"],["futuristic","Futuristic"],["cyberpunk","Cyberpunk"],["comic","Comic illustration"]];
export default function CampaignImageChoices({title,description,onApply,disabled=false,initialStyle="interstellar",initialCaption="",onSettingsChange}){
 const [style,setStyle]=useState(initialStyle||"interstellar");
 const [caption,setCaption]=useState(initialCaption||"");
 const [status,setStatus]=useState("idle");
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [file,setFile]=useState(null);
 const [preview,setPreview]=useState("");
 const urlRef=useRef("");
 const alive=useRef(true);
 const busy=useRef(false);
 const id=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;id.current++;if(urlRef.current)URL.revokeObjectURL(urlRef.current);};},[]);
 useEffect(()=>{setStyle(initialStyle||"interstellar");setCaption(initialCaption||"");},[initialStyle,initialCaption]);
 function updateStyle(value){setStyle(value);onSettingsChange?.({image_style:value,image_caption:caption});}
 function updateCaption(value){setCaption(value);onSettingsChange?.({image_style:style,image_caption:value});}
 function clear(){
  id.current++;if(urlRef.current)URL.revokeObjectURL(urlRef.current);
  urlRef.current="";setPreview("");setFile(null);setError("");setMessage("");
 }
 // While a generation or upload is in flight, editor prop churn must not
 // invalidate its request token: the server may already have charged the
 // trial allowance for a result the user would then never see (D8).
 useEffect(()=>{if(!busy.current)clear();},[title,description,style]);
 async function generate(){
  if(busy.current||disabled)return;
  if(title.trim().length<4||!description.trim()||description.trim().length<20){
    setError("Add a descriptive title and at least 20 characters about your goal before creating artwork.");return;
  }
  busy.current=true;setStatus("generating");setError("");setMessage("");
  const token=++id.current;
  try{
   const client=authClient(),{data:identity,error:identityError}=await client.auth.getUser();
   const {data:session,error:sessionError}=await client.auth.getSession();
   const owner=identity?.user;
   if(identityError||sessionError||!owner?.id||owner.is_anonymous||
      session?.session?.user?.id!==owner.id||!session.session.access_token)
     throw Error("Sign in to generate a campaign illustration.");
   const response=await fetch("/api/ai/images/generate",{
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.session.access_token},
    body:JSON.stringify({title:title.trim().slice(0,150),description:description.trim().slice(0,900),style}),
    signal:AbortSignal.timeout(90000)
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok)throw Error(result?.error||"The image service is unavailable.");
   const bytes=decodeGeneratedArtwork(result);
   const raw=new File([bytes],"ifund-original-illustration.jpg",{type:"image/jpeg"});
   const candidate=await overlayExactArtworkCaption(raw,caption);
   const after=await client.auth.getUser();
   if(after.error||after.data?.user?.id!==owner.id)throw Error("Your account changed. Artwork was not applied.");
   if(!alive.current)return;
   if(token!==id.current){setMessage("Your artwork finished, but the image settings changed while it was being created, so that result was discarded. Generate again to use the current text.");return;}
   const url=URL.createObjectURL(candidate);
   urlRef.current=url;setFile(candidate);setPreview(url);
   setMessage("Original iFund illustration generated. Review it; it is not a documentary photograph or an uploaded campaign cover.");
  }catch(cause){if(alive.current&&token===id.current)setError(cause?.message||"Could not generate artwork.");}
  finally{busy.current=false;if(alive.current)setStatus("idle");}
 }
 async function suggestWording(){
  if(busy.current||disabled||status!=="idle")return;
  if(title.trim().length<4){setError("Add your campaign title first, then ask AI for caption wording.");return;}
  busy.current=true;setStatus("caption");setError("");setMessage("");
  const token=++id.current;
  try{
   const result=await suggestCaption({title,description,kind:"image"});
   if(!alive.current||token!==id.current)return;
   updateCaption(result.caption.slice(0,100));clear();
   setMessage(result.source==="fallback"
    ?"AI wording was not usable, so your campaign title was filled in instead. Edit it freely — only the exact text in the box is ever printed."
    :"AI drafted the wording in the box. Suggestions are checked for real words and public-facing wording. Review and edit before creating your artwork.");
  }catch(cause){if(alive.current&&token===id.current)setError(cause?.message||"Caption suggestions are currently unavailable.");}
  finally{busy.current=false;if(alive.current)setStatus("idle");}
 }
 async function apply(){
  if(busy.current||disabled||!file)return;
  busy.current=true;setStatus("uploading");setError("");
  const token=id.current;
  try{
   const url=await uploadCampaignCover(authClient(),file);
   if(!alive.current)return;
   if(token!==id.current){setMessage("The illustration uploaded, but the campaign changed while it was saving, so it was not applied.");return;}
   onApply(url,{cover_image_is_ai:true});
   setMessage("Illustration uploaded to your public cover storage and selected in this draft. Save your campaign to retain it.");
  }catch(cause){if(alive.current&&token===id.current)setError(cause?.message||"Could not upload illustration.");}
  finally{busy.current=false;if(alive.current)setStatus("idle");}
 }
 return <details className="space-y-3 rounded-xl border border-cyan-400/30 p-4" aria-label="Generate optional iFund cover art">
   <summary className="cursor-pointer font-semibold">Or create your own original iFund illustration</summary>
   <p className="mt-3 text-sm text-muted-foreground">Make original campaign art. Eligible signup and referral-bonus trials provide time-limited access; paid subscribers have up to 50 image-generation or improvement attempts per rolling seven days. Shared provider capacity and fair-use pacing still apply. Review each illustration before using it.</p>
   <label className="mt-3 block text-sm font-medium">Illustration style
    <select value={style} disabled={disabled||status!=="idle"} onChange={e=>updateStyle(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3">
      {STYLES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   <label className="mt-3 block text-sm font-medium">Image words (optional, exact spelling)
     <input value={caption} maxLength={100} spellCheck={true} disabled={disabled||status!=="idle"} onChange={e=>{updateCaption(e.target.value);clear();}} placeholder="Your exact words, or an AI suggestion you approve" className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3"/>
   </label>
   <button type="button" disabled={disabled||status!=="idle"} onClick={()=>{const value=title.slice(0,100);updateCaption(value);clear();}} className="mt-2 min-h-11 rounded-lg border border-border px-3 text-sm">Use campaign title exactly</button>
   <button type="button" disabled={disabled||status!=="idle"} onClick={suggestWording} className="ml-2 mt-2 min-h-11 rounded-lg border border-border px-3 text-sm">{status==="caption"?"Asking AI…":"Suggest wording with AI"}</button>
   <p className="mt-2 text-xs text-muted-foreground">The image model draws without lettering; iFund adds the approved words using a regular font after generation. Type your own phrase, use the title, or let AI draft wording — every AI suggestion is checked to contain only real words, and you approve the final phrase before creating your artwork.</p>
   <button type="button" onClick={generate} disabled={disabled||status!=="idle"} className="mt-3 min-h-11 rounded-xl bg-cyan-600 px-4 font-semibold text-white disabled:opacity-50">
     {status==="generating"?"Creating illustration…":"Generate illustration"}
   </button>
   {error&&<p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
   {message&&<p role="status" className="mt-2 text-sm text-muted-foreground">{message}</p>}
   {preview&&<div className="mt-3 space-y-3">
     <img src={preview} alt="Preview of AI-generated illustrative campaign artwork" className="max-h-64 w-full rounded-xl object-contain" />
     <button type="button" onClick={apply} disabled={disabled||status!=="idle"} className="min-h-11 rounded-xl border border-cyan-400/60 px-4 font-semibold disabled:opacity-50">
       {status==="uploading"?"Saving illustration…":"Use this illustration"}
     </button>
     <button type="button" onClick={clear} disabled={disabled||status!=="idle"} className="ml-2 min-h-11 rounded-xl border border-border px-3">Discard</button>
   </div>}
   <p className="mt-2 text-xs text-muted-foreground">Trial and subscription access are verified by the server. The service may be paused, and the shared daily provider budget can temporarily stop generation. No images are published automatically.</p>
 </details>;
}
