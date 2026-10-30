import {useCallback,useEffect,useMemo,useState} from "react";
import {Search,Loader2} from "lucide-react";
import InstitutionCard from "@/components/institutions/InstitutionCard";
import {institutionTypes} from "@/components/institutions/institutionTypes";
import {listApprovedInstitutions} from "@/lib/institutions";

const programFilters=[
 {value:"all",label:"All"},{value:"offers_grants",label:"Grants"},
 {value:"offers_matching_gifts",label:"Matching Gifts"},
 {value:"offers_volunteer_program",label:"Volunteer Programs"}
];

export default function Institutions(){
 const [institutions,setInstitutions]=useState(null);
 const [query,setQuery]=useState("");
 const [typeFilter,setTypeFilter]=useState("all");
 const [programFilter,setProgramFilter]=useState("all");
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
   setError("");
   setInstitutions(null);
   try{setInstitutions(await listApprovedInstitutions())}
   catch{setError("We couldn't load institutions. Please try again.")}
 },[]);
 useEffect(()=>{let active=true;setError("");
   listApprovedInstitutions().then(data=>{if(active)setInstitutions(data)})
    .catch(()=>{if(active)setError("We couldn't load institutions. Please try again.")});
   return()=>{active=false}
 },[]);
 const filtered=useMemo(()=>{
   const q=query.trim().toLowerCase();
   return (institutions||[]).filter(i=>
     (typeFilter==="all"||i.type===typeFilter) &&
     (programFilter==="all"||i[programFilter]===true) &&
     (!q||["name","mission","industry","causes_supported","location"].some(k=>
       String(i[k]||"").toLowerCase().includes(q))));
 },[institutions,query,typeFilter,programFilter]);
 return <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
  <header className="flex flex-wrap items-start justify-between gap-4">
    <div><h1 className="font-display text-3xl sm:text-4xl text-stone-900">Institutions</h1>
      <p className="text-stone-500 mt-1">Businesses, foundations, and organizations partnering with campaigns.</p>
    </div>
  </header>
  <p className="mt-3 text-xs text-stone-500">Institution registration and application submission remain unavailable until the original identity, moderation, and application permissions are independently migrated. No unapproved institutions are shown.</p>
  {error?<section role="alert" className="mt-6 rounded-xl border p-4">
      {error} <button type="button" onClick={load} className="underline">Retry</button>
    </section>:
   institutions===null?<div role="status" className="flex items-center justify-center h-[40vh] gap-2"><Loader2 className="animate-spin"/>Loading institutions…</div>:
   <>
    <label className="relative mt-8 mb-4 block">
      <span className="sr-only">Search institutions</span>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"/>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, mission, industry, cause, or location…"
        className="w-full min-h-11 pl-9 rounded-xl border border-input bg-background"/>
    </label>
    <div className="flex gap-2 overflow-x-auto pb-2">
      {programFilters.map(f=><button type="button" key={f.value} onClick={()=>setProgramFilter(f.value)}
        aria-pressed={programFilter===f.value}
        className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${programFilter===f.value?"bg-stone-900 text-white":"bg-white border border-stone-200 text-stone-600"}`}>{f.label}</button>)}
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
      {Object.entries({all:"All types",...institutionTypes}).map(([value,label])=>
        <button type="button" key={value} onClick={()=>setTypeFilter(value)}
          aria-pressed={typeFilter===value}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${typeFilter===value?"bg-primary text-primary-foreground":"bg-white border border-stone-200 text-stone-600"}`}>{label}</button>)}
    </div>
    {filtered.length===0?<p className="text-sm text-stone-500 text-center py-16">
      {institutions.length===0?"No approved institutions are publicly available yet.":"No institutions match your filters."}
    </p>:<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {filtered.map(i=><InstitutionCard key={i.id} institution={i}/>)}
    </div>}
   </>}
 </main>;
}
