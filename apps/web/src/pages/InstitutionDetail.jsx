import {useEffect,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {Building2,MapPin,BadgeCheck,Loader2} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import InstitutionProfile from "@/components/institutions/InstitutionProfile";
import {institutionTypes,opportunityCategories} from "@/components/institutions/institutionTypes";
import {getApprovedInstitution,listApprovedOpportunities} from "@/lib/institutions";

export default function InstitutionDetail(){
 const {id}=useParams();
 const [state,setState]=useState({phase:"loading",institution:null,opportunities:[],error:""});
 const [activeTab,setActiveTab]=useState("profile");
 const [version,setVersion]=useState(0);
 useEffect(()=>{
   let alive=true;
   setState({phase:"loading",institution:null,opportunities:[],error:""});
   (async()=>{
     try {
       const institution=await getApprovedInstitution(id);
       if(!institution){if(alive)setState({phase:"missing",institution:null,opportunities:[],error:""});return;}
       const opportunities=await listApprovedOpportunities(id);
       if(alive)setState({phase:"ready",institution,opportunities,error:""});
     }catch{
       if(alive)setState({phase:"error",institution:null,opportunities:[],error:"We couldn't load this institution. Please try again."});
     }
   })();
   return()=>{alive=false};
 },[id,version]);
 const i=state.institution;
 if(state.phase==="loading")return <div role="status" className="flex items-center justify-center gap-2 h-[60vh]"><Loader2 className="animate-spin"/>Loading institution…</div>;
 if(state.phase==="error")return <section role="alert" className="mx-auto max-w-4xl p-6">
   <p>{state.error}</p><button onClick={()=>setVersion(n=>n+1)} className="underline">Retry</button>
 </section>;
 if(state.phase==="missing")return <p className="text-center text-stone-400 py-20">Institution not found or not approved for public viewing.</p>;
 return <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <Link to="/institutions" className="text-sm text-primary underline">All institutions</Link>
  <header className="flex items-start gap-4 mt-4 mb-6">
    <span className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-600 flex items-center justify-center">
      <Building2 className="w-7 h-7 text-white" aria-hidden="true"/>
    </span>
    <div>
      <h1 className="font-display text-3xl sm:text-4xl text-stone-900 flex items-center gap-2">
       {i.name}{i.verification_status==="verified"&&<BadgeCheck className="w-6 h-6 text-emerald-600" aria-label="Verified institution"/>}
      </h1>
      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-stone-500">
        <Badge variant="secondary">{institutionTypes[i.type]||i.type}</Badge>
        {i.location&&<span className="flex items-center gap-1"><MapPin className="w-4 h-4" aria-hidden="true"/>{i.location}</span>}
      </div>
    </div>
  </header>
  <nav aria-label="Institution sections" className="mb-6 flex flex-wrap gap-2">
    <button type="button" onClick={()=>setActiveTab("profile")} aria-current={activeTab==="profile"?"page":undefined}
      className={activeTab==="profile"?"rounded-lg bg-primary px-4 py-2 text-primary-foreground":"rounded-lg border px-4 py-2"}>Profile</button>
    <button type="button" onClick={()=>setActiveTab("opportunities")} aria-current={activeTab==="opportunities"?"page":undefined}
      className={activeTab==="opportunities"?"rounded-lg bg-primary px-4 py-2 text-primary-foreground":"rounded-lg border px-4 py-2"}>Opportunities</button>
  </nav>
  {activeTab==="profile"?<InstitutionProfile institution={i}/>:
   <section className="space-y-4" aria-label="Public institution opportunities">
     {state.opportunities.length===0?<p className="rounded-2xl border bg-card p-5">No approved opportunities are currently available for this institution.</p>:
       state.opportunities.map(o=><article key={o.id} className="rounded-2xl border border-stone-200 bg-white p-5 space-y-2">
         <p className="text-xs uppercase font-semibold text-primary">{opportunityCategories[o.category]||o.category}</p>
         <h2 className="text-xl font-semibold text-stone-900">{o.title}</h2>
         {o.description&&<p className="text-sm whitespace-pre-wrap text-stone-600">{o.description}</p>}
         {o.award_amount&&<p className="text-sm text-stone-700">Award: {o.award_amount}</p>}
         {o.eligibility&&<p className="text-sm text-stone-700">Eligibility: {o.eligibility}</p>}
         {o.deadline&&<p className="text-sm text-stone-700">Deadline: {o.deadline}</p>}
         <Badge variant="secondary">{o.status}</Badge>
       </article>)}
     <p className="text-xs text-muted-foreground">Applications and institution-management controls require the original access, role and submission workflows to be ported and independently verified.</p>
   </section>}
 </main>;
}
