import React from "react";
import { maturityLevels, governanceBodies, sreObjectives, devSecOpsLifecycle, qualityGates } from "./operations";
import { TrendingUp, Users, Gauge, GitMerge, CheckCircle2 } from "lucide-react";

function Section({ icon, title, children }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-2xl text-stone-900 mt-10 mb-4 first:mt-0">{icon}{title}</h2>
      {children}
    </div>
  );
}

export default function OperationsPanel() {
  return (
    <div className="space-y-2">
      <div className="bg-slate-900 rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <p className="font-display text-2xl text-white">Operational Maturity & Governance</p>
        </div>
        <p className="text-sm text-stone-400 mt-1.5">
          The capstone of Phase 5 — how Interplanetary Fund evolves from manual operations to an intelligent, self-improving enterprise while governance keeps it coherent.
        </p>
      </div>

      <Section icon={<TrendingUp className="w-5 h-5 text-primary" />} title="Operational Maturity Model">
        <div className="space-y-3">
          {maturityLevels.map((m, i) => (
            <div key={m.level} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 flex items-start gap-4">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${i === maturityLevels.length - 1 ? "bg-primary text-white" : "bg-stone-900 text-white"}`}>{m.level}</span>
              <div>
                <p className="font-semibold text-stone-900">{m.name}</p>
                <p className="text-sm text-stone-500 mt-1">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<Users className="w-5 h-5 text-primary" />} title="Governance Bodies">
        <div className="grid sm:grid-cols-2 gap-3">
          {governanceBodies.map((g) => (
            <div key={g.name} className="bg-white rounded-xl border border-stone-200/70 shadow-sm p-4">
              <p className="font-medium text-stone-900">{g.name}</p>
              <p className="text-sm text-stone-500 mt-1">{g.scope}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<Gauge className="w-5 h-5 text-primary" />} title="Site Reliability Engineering">
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
          {sreObjectives.map((s) => (
            <div key={s.label} className="px-5 py-3.5">
              <p className="text-sm font-semibold text-stone-900">{s.label}</p>
              <p className="text-sm text-stone-500 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<GitMerge className="w-5 h-5 text-primary" />} title="DevSecOps Lifecycle">
        <div className="flex flex-wrap items-center gap-2">
          {devSecOpsLifecycle.map((step, i) => (
            <React.Fragment key={step}>
              <span className="text-xs rounded-md bg-stone-900 text-white px-2.5 py-1">{step}</span>
              {i < devSecOpsLifecycle.length - 1 && <span className="text-stone-300">→</span>}
            </React.Fragment>
          ))}
        </div>
      </Section>

      <Section icon={<CheckCircle2 className="w-5 h-5 text-primary" />} title="Release Certification Gates">
        <div className="flex flex-wrap gap-1.5">
          {qualityGates.map((g) => (
            <span key={g} className="text-xs rounded-md bg-emerald-50 text-emerald-700 px-2 py-1">{g}</span>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-3">No release is certified until every gate passes — the record becomes part of the platform's governance history.</p>
      </Section>
    </div>
  );
}