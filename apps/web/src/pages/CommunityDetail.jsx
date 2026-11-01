import {useEffect,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {Users,MapPin,Loader2,UserPlus} from "lucide-react";
import {Badge} from "@/components/ui/badge";
import {communityTypes,loadPublicCommunity,loadListedCommunityMembers,loadMyCommunityMembership}
  from "@/lib/communities";

export default function CommunityDetail(){
 const {id}=useParams();
 const [tab,setTab]=useState("discussions");
 const [state,setState]=useState({phase:"loading",community:null,members:[],mine:null});
 const [generation,setGeneration]=useState(0);
 useEffect(()=>{
  let active=true;
  setState({phase:"loading",community:null,members:[],mine:null});
  (async()=>{
   try{
    const c=await loadPublicCommunity(id);
    if(!c){if(active)setState({phase:"missing",community:null,members:[],mine:null});return;}
    const [members,mine]=await Promise.all([
      loadListedCommunityMembers(id),loadMyCommunityMembership(id)
    ]);
    if(active)setState({phase:"ready",community:c,members,mine});
   }catch{
    if(active)setState({phase:"error",community:null,members:[],mine:null});
   }
  })();
  return()=>{active=false};
 },[id,generation]);
 const {community,members,mine}=state;
 if(state.phase==="loading")return <div className="flex items-center justify-center gap-3 h-[60vh]" role="status"><Loader2 className="animate-spin"/>Loading community…</div>;
 if(state.phase==="error")return <section className="max-w-4xl mx-auto px-6 py-10" role="alert">
  <p>We couldn't load this community. Please try again.</p>
  <button type="button" onClick={()=>setGeneration(v=>v+1)} className="mt-3 underline">Retry</button>
 </section>;
 if(state.phase==="missing")return <p className="text-center text-stone-400 py-20">Community not found or not approved for public viewing.</p>;
 const canManage=mine&&["owner","moderator"].includes(mine.role);
 return <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
   <div>
    <h1 className="font-display text-3xl sm:text-4xl text-stone-900">{community.name}</h1>
    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-stone-500">
     <Badge variant="secondary">{communityTypes[community.type]||community.type}</Badge>
     {community.location&&<span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" aria-hidden="true"/>{community.location}</span>}
    </div>
    {community.description&&<p className="text-stone-600 mt-3 max-w-2xl">{community.description}</p>}
   </div>
   {mine?<p className="rounded-xl border px-3 py-2 text-sm">Your membership: {mine.role}</p>:
     <div className="space-y-2">
      <p className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
       <UserPlus className="h-4 w-4" aria-hidden="true"/>Community joining unavailable</p>
     </div>}
  </header>
  <aside className="mb-5 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
   <p className="text-sm font-semibold text-slate-950">IFund Reporter & community blogs</p>
   <p className="text-xs text-slate-700 mt-1">Read featured Interplanetary Fund stories, or write about your community and the causes you care about.</p>
   <Link to="/blogs" className="text-blue-700 font-medium underline text-sm inline-block mt-2">Browse the newsletter and member blogs</Link>
  </aside>
  <nav aria-label="Community sections" className="flex flex-wrap gap-2 mb-6">
   {[["discussions","Discussions"],["volunteer","Volunteer"],["members","Members"]].map(([value,label])=>
    <button type="button" key={value} aria-current={tab===value?"page":undefined}
     className={tab===value?"rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground":"rounded-lg border px-4 py-2"}
     onClick={()=>setTab(value)}>{label}</button>)}
  </nav>
  {tab==="discussions"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">Discussions</h2>
   <p className="mt-2 text-sm text-muted-foreground">Discussions will become available when the original community discussion content, moderation permissions and signed-in creation workflow are verified.</p>
   <Link to="/social" className="mt-4 inline-block underline">IFund Social</Link>
  </section>}
  {tab==="volunteer"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="text-lg font-semibold">Volunteer opportunities</h2>
   <p className="mt-2 text-sm text-muted-foreground">Volunteer opportunities and applications require validated original event records and organizer permissions.</p>
   {canManage&&<p className="mt-3 text-xs text-muted-foreground">Your moderator status was verified; posting controls are disabled until server authorization is complete.</p>}
  </section>}
  {tab==="members"&&<section className="rounded-2xl border bg-card p-5">
   <h2 className="inline-flex items-center gap-2 text-lg font-semibold"><Users aria-hidden="true" className="h-5 w-5"/>Members</h2>
   <p className="mt-2 text-xs text-muted-foreground">Showing at most 100 members who explicitly opted into public listing. This is not the total member count.</p>
   {members.length===0?<p className="mt-3 text-sm">No public member listings yet.</p>:
     <ul className="mt-4 space-y-2">{members.map(m=><li key={m.id} className="rounded-lg border p-3 text-sm">
       {m.public_display_name||"Community member"} · {m.role}</li>)}</ul>}
  </section>}
 </main>;
}
