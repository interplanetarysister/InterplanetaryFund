import {useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {
  validateLibraryFile,listMyMedia,uploadMyMedia,downloadMyMedia,deleteMyMedia,
  listIncompleteMedia,removeIncompleteMedia
} from "@/api/memberMedia";

const button="ifund-interactive min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50";

function saveBlob(blob,name){
 const objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=objectUrl;a.download=name;a.rel="noopener";document.body.append(a);
 a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(objectUrl),15000);
}
/** Account-scoped private library; this is NOT the public campaign-cover store. */
export default function PrivateMediaLibrary({onOpenMedia}){
 const [rows,setRows]=useState([]);
 const [orphans,setOrphans]=useState([]);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [verified,setVerified]=useState(false);
 const revision=useRef(0),unmounted=useRef(false),fileInput=useRef(null);
 async function reload(){
  const generation=++revision.current;
  setLoading(true);setError("");
  try{
   const client=authClient();
   const identity=await client.auth.getUser();
   if(identity.error||!identity.data?.user?.id||identity.data.user.is_anonymous||!identity.data.user.email_confirmed_at)
     throw Error("Sign in with a confirmed email to access your saved media.");
   const files=await listMyMedia(client);
   if(!unmounted.current&&generation===revision.current){setRows(files);setVerified(true);}
  }catch(e){
   if(!unmounted.current&&generation===revision.current){
    setRows([]);setVerified(false);setError(e.message||"Your media library could not be loaded.");
   }
  }finally{if(!unmounted.current&&generation===revision.current)setLoading(false);}
 }
 useEffect(()=>{
  unmounted.current=false;void reload();
  const {data}=authClient().auth.onAuthStateChange(()=>{
   ++revision.current;setRows([]);setOrphans([]);setVerified(false);setMessage("");setBusy("");
   void reload();
  });
  return()=>{unmounted.current=true;revision.current++;data?.subscription?.unsubscribe();};
 },[]);
 async function run(label,job,{refresh=true}={}){
  if(busy||loading)return;
  const generation=revision.current;
  setBusy(label);setError("");setMessage("");
  try{
   const result=await job();
   if(unmounted.current||generation!==revision.current)return;
   if(refresh)await reload();
   if(!unmounted.current&&revision.current===(refresh?generation+1:generation))
     setMessage(label==="upload"?"Media uploaded to your private library.":
       label==="delete"?"Stored media deleted and verified absent.":
       label==="scan"?"Incomplete upload scan finished.":
       label==="orphan"?"Abandoned upload securely removed.":"Media retrieved.");
   return result;
  }catch(e){if(!unmounted.current&&generation===revision.current)setError(e.message||"Media operation failed.");}
  finally{if(!unmounted.current&&revision.current===(refresh?generation+1:generation))setBusy("");}
 }
 async function upload(e){
  const file=e.currentTarget.files?.[0];
  e.currentTarget.value="";
  if(!file)return;
  const problem=validateLibraryFile(file);
  if(problem){setError(problem);return;}
  await run("upload",()=>uploadMyMedia(authClient(),file));
 }
 async function download(item){
  await run("download",async()=>{
   const blob=await downloadMyMedia(authClient(),item);
   saveBlob(blob,item.file_name);
  },{refresh:false});
 }
 async function open(item){
  if(!onOpenMedia)return;
  await run("open",async()=>{
   const blob=await downloadMyMedia(authClient(),item);
   const file=new File([blob],item.file_name,{type:item.content_type});
   await onOpenMedia(file);
  },{refresh:false});
 }
 async function remove(item){
  if(!window.confirm('Permanently delete "'+item.file_name+'" from your private iFund storage? This cannot be undone.'))return;
  await run("delete",()=>deleteMyMedia(authClient(),item));
 }
 async function scan(){
  await run("scan",async()=>{const files=await listIncompleteMedia(authClient());setOrphans(files);},{refresh:false});
 }
 async function removeOrphan(item){
  if(!window.confirm("Delete this abandoned R2 upload? Only incomplete files older than 24 hours without a registered media entry qualify."))return;
  await run("orphan",async()=>{
   await removeIncompleteMedia(authClient(),item);
   setOrphans(current=>current.filter(row=>row.path!==item.path));
  },{refresh:false});
 }
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Private cloud media library">
  <div className="space-y-2">
   <h2 className="text-xl font-semibold">Saved media</h2>
   <p className="text-sm text-muted-foreground">
    Upload images, audio and video into your own private iFund library. Files are accessible from your account on other devices,
    but are not public posts or campaign images until you choose to publish separately.
    Images: 5 MB; audio: 16 MB; video: 40 MB. Maximum 50 files or 256 MB total per account.
   </p>
  </div>
  <div className="flex flex-wrap gap-3">
   <label className={button+" inline-flex cursor-pointer items-center"}>
    Upload to private library
    <input ref={fileInput} className="sr-only" type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mp3,.wav,.ogg,.m4a,image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
      disabled={!verified||loading||!!busy||rows.length>=50} onChange={e=>void upload(e)}/>
   </label>
   <button type="button" className={button} disabled={loading||!!busy} onClick={()=>void reload()}>Refresh saved media</button>
  </div>
  {loading&&<p role="status">Loading your saved media…</p>}
  {busy&&<p role="status">{busy==="upload"?"Uploading and verifying file bytes…":"Verifying the selected media operation…"}</p>}
  {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  {verified&&<p className="text-sm text-muted-foreground">{rows.length}/50 files · {(rows.reduce((sum,row)=>sum+row.file_size,0)/1048576).toFixed(1)}/256 MB used</p>}
  {verified&&!rows.length&&!loading&&<p className="rounded-xl border border-dashed border-border p-4 text-sm">No saved cloud media yet. Upload an image, audio recording, or video to get started.</p>}
  {verified&&rows.length>0&&<ul className="space-y-2">
   {rows.map(item=><li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3" key={item.id}>
    <div className="min-w-0">
     <p className="truncate font-semibold">{item.file_name}</p>
     <p className="text-xs text-muted-foreground">{item.content_kind} · {(item.file_size/1048576).toFixed(2)} MB · {item.deletion_requested_at?"Deletion pending":"Private R2 file"}</p>
    </div>
    <div className="flex flex-wrap gap-2">
     {!item.deletion_requested_at&&onOpenMedia&&<button type="button" className={button} disabled={!!busy} onClick={()=>void open(item)}>Open in Editor</button>}
     {!item.deletion_requested_at&&<button type="button" className={button} disabled={!!busy} onClick={()=>void download(item)}>Download</button>}
     <button type="button" className={button} disabled={!!busy} onClick={()=>void remove(item)}>
      {item.deletion_requested_at?"Retry deletion":"Delete permanently"}
     </button>
    </div>
   </li>)}
  </ul>}
  {verified&&<details className="rounded-xl border border-border p-3">
   <summary className="cursor-pointer font-medium">Recover storage from incomplete uploads</summary>
   <p className="my-2 text-xs text-muted-foreground">Scan your own private files for uploads older than 24 hours with no saved media record. Registered files are never removed by this cleanup.</p>
   <button type="button" className={button} disabled={!!busy||loading} onClick={()=>void scan()}>Find abandoned uploads</button>
   {orphans.length>0&&<ul className="mt-3 space-y-2">{orphans.map(item=><li key={item.path} className="flex flex-wrap items-center justify-between gap-2">
    <span className="break-all text-sm">{item.name}</span>
    <button type="button" className={button} disabled={!!busy} onClick={()=>void removeOrphan(item)}>Delete abandoned file</button>
   </li>)}</ul>}
  </details>}
 </section>;
}
