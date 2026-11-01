import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bot, Radio, User, Users } from "lucide-react";
import { owningNavigationTab } from "@/lib/navigation";
import { hapticTap } from "@/lib/haptics";

// A single mobile tab bar shared by the public home, web app and installed PWA.
export const IFUND_BOTTOM_TABS=[
  {to:"/agents",label:"AI Team",icon:Bot},
  {to:"/profile",label:"Profile",icon:User},
  {to:"/social",label:"IFund Social",icon:Radio},
  {to:"/community",label:"Forums",icon:Users},
];
export default function MobileBottomNav({user,onNavigate}){
 const {pathname}=useLocation();
 const active=owningNavigationTab(pathname,!!user);
 return <nav aria-label="Bottom navigation" className="ifund-mobile-nav md:hidden fixed inset-x-0 bottom-0 z-40 border-t flex pb-safe">
  {IFUND_BOTTOM_TABS.map(({to,label,icon:Icon})=>{
   const destination=user||["/social","/community"].includes(to)
    ?to:`/login?returnTo=${encodeURIComponent(to)}`;
   const selected=active===to;
   return <NavLink key={to} to={destination} end onClick={()=>{hapticTap();onNavigate?.();}}
     aria-current={selected?"page":undefined}
     className={selected?
       "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] text-xs font-medium text-cyan-400":
       "flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] text-xs font-medium text-slate-400"}>
    <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75}/>
    <span className="max-w-full truncate px-0.5 text-center">{label}</span>
   </NavLink>;
  })}
 </nav>;
}
