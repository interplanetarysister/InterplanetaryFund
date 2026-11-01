import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  charter, coreValues, immutableLaws, governanceHierarchy,
  architectureLayers, releaseRoadmap, sharedServices,
} from "./constitution";
import { ScrollText, Scale, Layers, Map, ShieldCheck } from "lucide-react";

function SectionTitle({ icon, children }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-2xl text-stone-900 mt-10 mb-4 first:mt-0">
      {icon}{children}
    </h2>
  );
}

export default function ConstitutionPanel() {
  return (
    <div className="space-y-2">
      {/* Charter */}
      <div className="bg-slate-900 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <ScrollText className="w-5 h-5 text-primary" />
          <p className="font-display text-2xl text-white">Interplanetary Fund Platform Constitution</p>
          <Badge className="ml-1 bg-primary text-primary-foreground hover:bg-primary/90">v{charter.version}</Badge>
        </div>
        <p className="text-sm text-stone-400">{charter.status}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Vision</p>
          <p className="text-sm text-stone-700">{charter.vision}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Mission</p>
          <p className="text-sm text-stone-700">{charter.mission}</p>
        </div>
      </div>

      {/* Core values */}
      <SectionTitle icon={<Scale className="w-5 h-5 text-primary" />}>Core Values</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3">
        {coreValues.map((v) => (
          <div key={v.id} className="bg-white rounded-xl border border-stone-200/70 shadow-sm p-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-stone-400">{v.id}</span>
              <p className="font-medium text-stone-900">{v.name}</p>
            </div>
            <p className="text-sm text-stone-500 mt-1">{v.statement}</p>
          </div>
        ))}
      </div>

      {/* Immutable laws */}
      <SectionTitle icon={<ShieldCheck className="w-5 h-5 text-primary" />}>Immutable Architectural Laws</SectionTitle>
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
        {immutableLaws.map((l) => (
          <div key={l.id} className="flex gap-3 px-5 py-3.5">
            <Badge variant="secondary" className="font-mono shrink-0">{l.id}</Badge>
            <p className="text-sm text-stone-700">{l.law}</p>
          </div>
        ))}
      </div>

      {/* Governance hierarchy */}
      <SectionTitle icon={<Scale className="w-5 h-5 text-primary" />}>Governance Hierarchy</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-3">
        {governanceHierarchy.map((g) => (
          <div key={g.layer} className="bg-white rounded-xl border border-stone-200/70 shadow-sm p-4">
            <p className="font-medium text-stone-900">{g.layer}</p>
            <p className="text-sm text-stone-500 mt-0.5">{g.purpose}</p>
          </div>
        ))}
      </div>

      {/* Architecture layers */}
      <SectionTitle icon={<Layers className="w-5 h-5 text-primary" />}>Master Architecture — Ten Layers</SectionTitle>
      <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
        {architectureLayers.map((l) => (
          <div key={l.n} className="flex items-start gap-3 px-5 py-3.5">
            <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">{l.n}</span>
            <div>
              <p className="text-sm font-medium text-stone-900">{l.name}</p>
              <p className="text-xs text-stone-500 mt-0.5">{l.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Shared services */}
      <SectionTitle icon={<Layers className="w-5 h-5 text-primary" />}>Shared Platform Services</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {sharedServices.map((s) => (
          <span key={s} className="text-xs rounded-md bg-stone-100 text-stone-600 px-2 py-1">{s}</span>
        ))}
      </div>

      {/* Release roadmap */}
      <SectionTitle icon={<Map className="w-5 h-5 text-primary" />}>Implementation Roadmap</SectionTitle>
      <div className="space-y-3">
        {releaseRoadmap.map((r, i) => (
          <div key={r.release} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-700 text-sm font-bold flex items-center justify-center">{i + 1}</span>
              <p className="font-semibold text-stone-900">{r.release}</p>
            </div>
            <p className="text-sm text-stone-500 mt-2">{r.goal}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-400 text-center pt-6">
        If a future feature conflicts with this Constitution, the feature is redesigned — not the platform.
      </p>
    </div>
  );
}