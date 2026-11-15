import {useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {DOCUMENT_CATEGORIES,loadAgentDocumentBriefs} from "@/api/campaignDocuments";

const EMPTY={loading:false,items:[],error:""};
/** Owner-reviewed, unverified excerpts. Never publishes or sends. */
export default function AgentDocumentReferences({campaignId,onInsert,disabled=false}){
  const [state,setState]=useState(EMPTY);
  const [verifiedOwner,setVerifiedOwner]=useState(null);
  const scope=useRef({generation:0,owner:null,campaignId:null});
  useEffect(()=>{
    const client=authClient();
    let alive=true;
    const generation=++scope.current.generation;
    scope.current.owner=null;
    scope.current.campaignId=campaignId;
    setVerifiedOwner(null);
    setState({loading:Boolean(campaignId),items:[],error:""});
    const valid=(token,owner)=>alive&&scope.current.generation===token&&scope.current.owner===owner&&scope.current.campaignId===campaignId;
    async function load(owner,token){
      try{
        const items=await loadAgentDocumentBriefs(client,campaignId);
        const {data,error}=await client.auth.getUser();
        if(!error&&data?.user?.id===owner&&valid(token,owner)){
          setState({loading:false,items,error:""});
        }else if(valid(token,owner)){
          scope.current.owner=null;
          setVerifiedOwner(null);
          setState({loading:false,items:[],error:"Account verification changed. Sign in again to view references."});
        }
      }catch(error){
        if(valid(token,owner))setState({loading:false,items:[],error:error?.message||"References unavailable."});
      }
    }
    function switchOwner(owner){
      const token=++scope.current.generation;
      scope.current.owner=owner;
      setVerifiedOwner(owner);
      setState({loading:Boolean(owner&&campaignId),items:[],error:owner?"":"Sign in to view private references."});
      if(owner&&campaignId)void load(owner,token);
    }
    const {data:subscription}=client.auth.onAuthStateChange((_event,session)=>{
      if(!alive)return;
      const owner=session?.user?.id||null;
      // Invalidate outstanding work even when A -> B -> A happens before resolution.
      if(owner!==scope.current.owner)switchOwner(owner);
    });
    // Initial identity lookup must not overwrite a newer auth event.
    const initialToken=scope.current.generation;
    client.auth.getUser().then(({data,error})=>{
      if(!alive||scope.current.generation!==initialToken)return;
      switchOwner(error?null:data?.user?.id||null);
    }).catch(()=>{
      if(alive&&scope.current.generation===initialToken)switchOwner(null);
    });
    return()=>{
      alive=false;
      ++scope.current.generation;
      scope.current.owner=null;
      subscription?.subscription?.unsubscribe();
    };
  },[campaignId]);

  async function insert(item){
    const {generation,owner,campaignId:activeCampaign}=scope.current;
    if(disabled||!owner||activeCampaign!==campaignId||typeof onInsert!=="function")return;
    try{
      const {data,error}=await authClient().auth.getUser();
      if(error||data?.user?.id!==owner||scope.current.generation!==generation||scope.current.owner!==owner)return;
      onInsert(item.summary);
    }catch{/* Fail closed on identity errors. */}
  }
  if(!campaignId)return null;
  const items=verifiedOwner&&scope.current.owner===verifiedOwner?state.items:[];
  return <section className="rounded-xl border border-border p-4" aria-label="Campaign document reference suggestions">
    <h3 className="text-sm font-semibold">Private campaign references</h3>
    <p className="mt-1 text-xs text-muted-foreground">Only owner-enabled, user-supplied references appear here. They are not independently verified. Review before using in public materials.</p>
    {state.loading&&<p role="status" className="mt-2 text-xs">Loading your authorized references…</p>}
    {state.error&&<p role="alert" className="mt-2 text-xs text-muted-foreground">{state.error}</p>}
    {!state.loading&&!state.error&&items.length===0&&<p className="mt-2 text-xs text-muted-foreground">No references available. Enable documents under My campaigns, or sign in and try again.</p>}
    {items.length>0&&<ul className="mt-3 space-y-2">
      {items.map(item=><li key={item.document_id} className="rounded-lg border border-border p-3">
        <p className="text-xs font-semibold">{DOCUMENT_CATEGORIES[item.purpose]||"Campaign reference"}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs">{item.summary}</p>
        {typeof onInsert==="function"&&<button type="button" disabled={disabled||!verifiedOwner} onClick={()=>void insert(item)}
          className="mt-2 min-h-11 rounded-lg border border-border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          Insert selected facts into editable draft
        </button>}
      </li>)}
    </ul>}
  </section>;
}
