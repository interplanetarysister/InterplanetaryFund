import {useEffect,useState} from "react";
import {authClient} from "@/api/auth";
import {DOCUMENT_CATEGORIES,loadAgentDocumentBriefs} from "@/api/campaignDocuments";

/** Safe, owner-reviewed reference snippets. Inserting never publishes or sends. */
export default function AgentDocumentReferences({campaignId,onInsert,disabled=false}){
  const [state,setState]=useState({loading:false,items:[],error:""});
  useEffect(()=>{
    let current=true;
    setState({loading:Boolean(campaignId),items:[],error:""});
    if(!campaignId)return()=>{current=false;};
    loadAgentDocumentBriefs(authClient(),campaignId)
      .then(items=>{if(current)setState({loading:false,items,error:""});})
      .catch(e=>{if(current)setState({loading:false,items:[],error:e.message||"References unavailable."});});
    return()=>{current=false;};
  },[campaignId]);
  if(!campaignId)return null;
  return <section className="rounded-xl border border-border p-4" aria-label="Campaign document reference suggestions">
    <h3 className="text-sm font-semibold">Private campaign references</h3>
    <p className="mt-1 text-xs text-muted-foreground">
      Only documents you've enabled for agent use appear here. Descriptions and extracts are user-supplied,
      not independently verified. Review any details before using them in public materials.
    </p>
    {state.loading&&<p role="status" className="mt-2 text-xs">Loading your authorized references…</p>}
    {state.error&&<p role="alert" className="mt-2 text-xs text-muted-foreground">{state.error}</p>}
    {!state.loading&&!state.error&&state.items.length===0&&<p className="mt-2 text-xs text-muted-foreground">No documents are currently enabled for your agents. Add or enable documents under My campaigns.</p>}
    {state.items.length>0&&<ul className="mt-3 space-y-2">
      {state.items.map(item=><li key={item.document_id} className="rounded-lg border border-border p-3">
        <p className="text-xs font-semibold">{DOCUMENT_CATEGORIES[item.purpose]||"Campaign reference"}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs">{item.summary}</p>
        {typeof onInsert==="function"&&<button type="button" disabled={disabled} onClick={()=>onInsert(item.summary)}
          className="mt-2 min-h-11 rounded-lg border border-border px-3 text-xs font-semibold">
          Insert selected facts into editable draft
        </button>}
      </li>)}
    </ul>}
  </section>;
}
