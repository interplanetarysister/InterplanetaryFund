import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { operatingSystems, architecturalRules, managedByBase44 } from "./blueprint";
import { ChevronDown, ShieldCheck, Server } from "lucide-react";

function Chips({ label, items, className }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className={`text-xs rounded-md px-2 py-0.5 ${className}`}>{i}</span>
        ))}
      </div>
    </div>
  );
}

export default function BlueprintPanel() {
  const [open, setOpen] = useState(null);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-2xl p-6">
        <p className="font-display text-2xl text-white">Ten operating systems, one architecture</p>
        <p className="text-sm text-stone-400 mt-1.5">
          The authoritative ownership matrix. One capability, one owner — every other system consumes it
          through APIs, the Event Bus, and the Workflow Engine.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
        <h3 className="flex items-center gap-2 font-semibold text-sm text-stone-900">
          <ShieldCheck className="w-4 h-4 text-primary" /> Architectural rules
        </h3>
        <ul className="mt-3 space-y-1.5">
          {architecturalRules.map((r) => (
            <li key={r} className="text-sm text-stone-600">• {r}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {operatingSystems.map((os) => {
          const expanded = open === os.id;
          return (
            <div key={os.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm">
              <button
                onClick={() => setOpen(expanded ? null : os.id)}
                aria-expanded={expanded}
                className="w-full flex items-start justify-between gap-3 text-left p-5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Prompt {os.prompt}</Badge>
                    <p className="font-semibold text-stone-900">{os.name}</p>
                  </div>
                  <p className="text-sm text-stone-500 mt-1">{os.role}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 mt-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <div className="px-5 pb-5 space-y-4">
                  <Chips label="Owns" items={os.owns} className="bg-emerald-50 text-emerald-700" />
                  <Chips label="Never owns" items={os.neverOwns} className="bg-red-50 text-red-600" />
                  <Chips label="Data entities" items={os.entities} className="bg-stone-100 text-stone-600 font-mono" />
                  <Chips label="Events published" items={os.publishes} className="bg-cyan-50 text-cyan-700 font-mono" />
                  <Chips label="Events consumed" items={os.consumes} className="bg-stone-100 text-stone-600 font-mono" />
                  <Chips label="Depends on" items={os.dependsOn} className="bg-stone-100 text-stone-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
        <h3 className="flex items-center gap-2 font-semibold text-sm text-stone-900">
          <Server className="w-4 h-4 text-primary" /> Managed by Base44
        </h3>
        <p className="text-xs text-stone-400 mt-1 mb-3">Trusted infrastructure Interplanetary Fund builds on rather than reimplements.</p>
        <div className="flex flex-wrap gap-1.5">
          {managedByBase44.map((m) => (
            <span key={m} className="text-xs rounded-md bg-stone-100 text-stone-600 px-2 py-0.5">{m}</span>
          ))}
        </div>
      </div>
    </div>
  );
}