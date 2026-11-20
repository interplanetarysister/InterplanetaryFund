import React from "react";
import { AGENT_IDENTITIES, AgentIdentityIcon } from "./AgentIdentityIcon";

/** Only render backend-confirmed specialist invocations. No fabricated tool activity. */
export default function AgentConsultationTrail({ consultations=[] }){
  if(!Array.isArray(consultations) || consultations.length===0) return null;
  return <section aria-label="NEXUS specialist analysis" className="mt-3 space-y-3 rounded-xl border border-slate-600/50 bg-slate-950/40 p-3">
    <div className="flex items-center gap-2">
      <AgentIdentityIcon identity="nexus" size={30}/>
      <div>
        <p className="text-xs font-semibold">NEXUS coordinated specialist analysis</p>
        <p className="text-[11px] text-slate-400">Completed advisory AI calls · No external actions</p>
      </div>
    </div>
    {consultations.map((call,index)=>{
      const identity=AGENT_IDENTITIES[call.agent];
      if(!identity || call.status!=="completed" || call.kind!=="advisory_analysis") return null;
      return <div className="flex items-start gap-3 rounded-lg border border-slate-600/30 p-3" key={call.agent+":"+index}>
        <AgentIdentityIcon identity={call.agent} size={34}/>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{identity.name} <span className="font-normal text-slate-400">· {identity.role} · Analysis completed</span></p>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">{call.summary}</p>
        </div>
      </div>;
    })}
  </section>;
}
