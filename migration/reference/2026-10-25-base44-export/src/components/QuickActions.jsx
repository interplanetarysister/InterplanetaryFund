import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isAndroidApp, disableAndroidPush } from "@/lib/androidFirebaseFeatures";
import { Plus, Megaphone, Heart, LayoutDashboard, Sparkles, LogIn, LogOut, X } from "lucide-react";

export default function QuickActions({user}) {
  const [open,setOpen]=useState(false),[signingOut,setSigningOut]=useState(false);
  const loggedIn=!!user?.id;
  const gate=path=>loggedIn?path:`/login?returnTo=${encodeURIComponent(path)}`;
  const actions=[
    {to:gate("/create"),label:"Create a campaign",icon:Megaphone},
    {to:gate("/following"),label:"Saved / followed campaigns",icon:Heart},
    {to:gate("/dashboard"),label:"My campaigns and drafts",icon:LayoutDashboard},
    {to:gate("/mission"),label:"Campaign command center",icon:Sparkles},
  ];
  const logout=async()=>{
    if(signingOut)return;
    setSigningOut(true);
    try{if(isAndroidApp)await disableAndroidPush().catch(()=>{});await base44.auth.logout("/login");}
    catch{setSigningOut(false);setOpen(false);}
  };
  return <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 left-3 md:left-auto md:right-6 z-30 flex flex-col items-start md:items-end gap-2">
    {open&&<div className="flex flex-col items-start md:items-end gap-2 mb-1" role="menu" aria-label="Quick campaign and account actions">
      {actions.map(({to,label,icon:Icon})=><Link role="menuitem" key={label} to={to}
        onClick={()=>setOpen(false)} className="flex items-center gap-2 md:flex-row-reverse min-h-11">
        <span className="text-xs font-semibold text-white bg-slate-900 border border-cyan-300/30 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">{label}</span>
        <span className="w-10 h-10 rounded-full bg-slate-900 border border-white/30 flex items-center justify-center text-white shadow-xl"><Icon className="w-4 h-4"/></span>
      </Link>)}
      {loggedIn?<button type="button" role="menuitem" disabled={signingOut} onClick={logout}
        className="flex items-center gap-2 md:flex-row-reverse min-h-11">
        <span className="text-xs font-semibold text-white bg-slate-900 rounded-lg px-3 py-2 shadow-xl">{signingOut?"Signing out…":"Log out"}</span>
        <span className="w-10 h-10 rounded-full bg-slate-900 border border-white/30 flex items-center justify-center text-white"><LogOut className="w-4 h-4"/></span>
      </button>:<Link role="menuitem" to="/login" onClick={()=>setOpen(false)} className="flex items-center gap-2 md:flex-row-reverse min-h-11">
        <span className="text-xs font-semibold text-white bg-slate-900 rounded-lg px-3 py-2 shadow-xl">Log in</span>
        <span className="w-10 h-10 rounded-full bg-slate-900 border border-white/30 flex items-center justify-center text-white"><LogIn className="w-4 h-4"/></span>
      </Link>}
    </div>}
    <button type="button" onClick={()=>setOpen(v=>!v)}
      className="w-12 h-12 rounded-full bg-cyan-400 text-slate-950 shadow-xl border-2 border-slate-950 flex items-center justify-center hover:bg-cyan-300"
      aria-label={open?"Close quick actions":"Open quick actions"} aria-expanded={open}
      aria-haspopup="menu">{open?<X className="w-5 h-5"/>:<Plus className="w-5 h-5"/>}</button>
  </div>;
}
