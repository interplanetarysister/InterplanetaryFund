import {useMemo,useState} from "react";

/** Application preparation only; no external submission or source-data export. */
export default function PulseApplicationPreparation({opportunity,campaign}) {
 const [notes,setNotes]=useState("");
 const [notice,setNotice]=useState("");
 const [expanded,setExpanded]=useState(false);
 const guide=useMemo(()=>{
  const source=String(opportunity?.title||"Opportunity").slice(0,160);
  const provider=String(opportunity?.provider||"Provider").slice(0,160);
  const requirements=String(opportunity?.eligibility||"Verify current eligibility with the official source").slice(0,450);
  const project=campaign?.title?String(campaign.title).slice(0,160):"Not selected";
  return [
   "Application preparation worksheet — not submitted",
   "Program: "+source,
   "Provider: "+provider,
   "Campaign: "+project,
   "Provider-stated eligibility to verify: "+requirements,
   "Budget evidence: [Owner must provide verified cost breakdown]",
   "Impact evidence: [Owner must supply documented facts]",
   "Deadline verified with provider: [Date and source to confirm]",
   "Permission to disclose campaign details: [Confirm before sharing]",
   "Private owner notes: "+notes.trim(),
  ].join("\n");
 },[opportunity?.title,opportunity?.provider,opportunity?.eligibility,campaign?.title,notes]);
 async function copy(){
  try{await navigator.clipboard.writeText(guide);setNotice("Preparation worksheet copied for your review. No application was submitted.");}
  catch{setNotice("Clipboard unavailable. Select the worksheet text to copy manually.");}
 }
 return <section className="mt-3 rounded-xl border border-border p-3" aria-label="PULSE application preparation">
  <button type="button" className="min-h-11 w-full text-left text-sm font-semibold" aria-expanded={expanded}
   onClick={()=>setExpanded(x=>!x)}>{expanded?"Hide":"Prepare"} an application worksheet</button>
  {expanded&&<div className="mt-3 space-y-3">
   <p className="text-xs text-muted-foreground">This worksheet is made locally. It does not submit to the provider, verify that you qualify, or upload private campaign content.</p>
   <label className="block text-sm font-medium">Optional owner notes
    <textarea maxLength={800} value={notes} onChange={e=>setNotes(e.target.value)}
      className="mt-1 min-h-20 w-full rounded-lg border border-border bg-background p-2"/>
   </label>
   <textarea readOnly value={guide} aria-label="Draft application worksheet" className="min-h-48 w-full rounded-lg border border-border bg-background p-2 text-xs" />
   <button type="button" className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold" onClick={copy}>Copy worksheet for manual application</button>
   {notice&&<p role="status" className="text-xs">{notice}</p>}
  </div>}
 </section>;
}
