import React,{useEffect,useState} from "react";
import {Link,useParams} from "react-router-dom";
import {ArrowLeft,ExternalLink,FileText,Loader2} from "lucide-react";
import {getFinalPublication} from "@/lib/editorial";

const LABELS={
 report:"Report",status_report:"Status Report",presentation:"Slide Presentation",
 research:"Research",announcement:"IFund Update"
};
function approvedPdfUrl(value){
 if(!value)return null;
 try{
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password)return null;
  return url.href;
 }catch{return null;}
}
export default function PublicationArticle(){
 const {id}=useParams();
 const [item,setItem]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;setLoading(true);setError("");setItem(null);
  getFinalPublication(id).then(entry=>{
   if(!entry)throw Error("Unapproved or missing publication");
   if(active)setItem(entry);
  }).catch(()=>{if(active)setError("This publication is not available.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[id]);
 const pdf=approvedPdfUrl(item?.pdf_url);
 return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
  <Link to="/social?tab=publications"
    className="inline-flex items-center gap-2 text-blue-800 underline font-semibold">
    <ArrowLeft aria-hidden="true" className="w-4 h-4"/>Back to publications
  </Link>
  {loading?<p role="status" className="flex items-center gap-2 mt-8 text-slate-700">
    <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin"/>Loading publication…</p>:
   error||!item?<p role="alert" className="text-red-800 mt-8">
    {error||"Publication not found."}</p>:
   <article className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 text-slate-900">
    <p className="text-sm font-bold tracking-wide uppercase text-blue-800">
     {LABELS[item.kind]||"IFund Publication"}</p>
    <h1 className="text-3xl font-display font-semibold mt-3 text-slate-950">{item.title}</h1>
    <p className="text-sm text-slate-600 mt-3">Interplanetary Fund
     {item.published_at?" · "+new Date(item.published_at).toLocaleDateString():""}</p>
    <p className="text-lg font-medium text-slate-800 mt-5">{item.summary}</p>
    {item.body&&<div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
     {item.body.split(/\n\s*\n/).filter(Boolean).map((part,index)=>
      <p key={index} className="whitespace-pre-wrap break-words leading-relaxed text-slate-800">{part}</p>)}
    </div>}
    {pdf&&<section className="mt-7 border-t border-slate-200 pt-5">
     <h2 className="flex items-center gap-2 text-lg font-semibold">
      <FileText aria-hidden="true" className="h-5 w-5"/>Download or view the finalized PDF</h2>
     <a href={pdf} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center min-h-11 mt-3 gap-2 rounded-lg bg-blue-800 text-white px-4 py-2 font-semibold">
      <ExternalLink aria-hidden="true" className="w-4 h-4"/>Open PDF</a>
     <p className="text-sm text-slate-600 mt-3">If your phone does not preview PDFs, use Open PDF to view it in your browser.</p>
     <iframe title={item.file_label||item.title} src={pdf} loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      className="hidden sm:block mt-4 w-full h-[540px] rounded-lg border border-slate-300"/>
    </section>}
   </article>}
 </div>;
}
