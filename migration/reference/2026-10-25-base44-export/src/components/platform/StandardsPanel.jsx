import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  engineeringPrinciples, naming, branches, commits, versioning,
  codeReview, qualityGates, aiDevStandards, metrics, dxPlatform,
} from "./standards";
import { Code2, GitBranch, GitCommit, Tag, CheckSquare, ShieldCheck, Bot, Gauge, Wrench } from "lucide-react";

function Section({ icon, title, children }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-2xl text-stone-900 mt-10 mb-4 first:mt-0">{icon}{title}</h2>
      {children}
    </div>
  );
}

export default function StandardsPanel() {
  return (
    <div className="space-y-2">
      <div className="bg-slate-900 rounded-2xl p-6">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-primary" />
          <p className="font-display text-2xl text-white">Engineering Standards</p>
        </div>
        <p className="text-sm text-stone-400 mt-1.5">
          The operational rules every contributor, AI assistant, and pipeline follows — companion to the Constitution and Architecture Blueprint.
        </p>
      </div>

      <Section icon={<Gauge className="w-5 h-5 text-primary" />} title="Engineering Principles">
        <div className="flex flex-wrap gap-2">
          {engineeringPrinciples.map((p) => (
            <span key={p} className="text-xs rounded-md bg-white border border-stone-200/70 text-stone-700 px-2.5 py-1">{p}</span>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-3">Every contribution improves at least one — without degrading the others.</p>
      </Section>

      <Section icon={<Code2 className="w-5 h-5 text-primary" />} title="Naming Conventions">
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
          {naming.map((n) => (
            <div key={n.area} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-stone-900">{n.area}</p>
                <Badge variant="secondary" className="shrink-0">{n.note}</Badge>
              </div>
              <p className="text-xs font-mono text-stone-500 mt-1 break-all">{n.pattern}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<GitBranch className="w-5 h-5 text-primary" />} title="Branch Strategy">
        <div className="grid sm:grid-cols-2 gap-3">
          {branches.map((b) => (
            <div key={b.branch} className="bg-white rounded-xl border border-stone-200/70 shadow-sm p-4">
              <p className="font-mono text-sm text-primary">{b.branch}</p>
              <p className="text-sm text-stone-500 mt-0.5">{b.purpose}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<GitCommit className="w-5 h-5 text-primary" />} title="Commit Standards">
        <div className="bg-stone-900 rounded-2xl p-4 font-mono text-xs space-y-1.5">
          {commits.map((c) => (
            <p key={c} className="text-stone-300">{c}</p>
          ))}
        </div>
      </Section>

      <Section icon={<Tag className="w-5 h-5 text-primary" />} title="Versioning — Semantic Versioning">
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
          {versioning.map((v) => (
            <div key={v.part} className="flex items-center gap-3 px-5 py-3.5">
              <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono">{v.part}</Badge>
              <p className="text-sm text-stone-600">{v.meaning}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<CheckSquare className="w-5 h-5 text-primary" />} title="Code Review Checklist">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {codeReview.map((c) => (
            <p key={c} className="text-sm text-stone-600 flex gap-2"><span className="text-primary">✓</span>{c}</p>
          ))}
        </div>
      </Section>

      <Section icon={<ShieldCheck className="w-5 h-5 text-primary" />} title="Code Quality Gates">
        <div className="flex flex-wrap gap-1.5">
          {qualityGates.map((g) => (
            <span key={g} className="text-xs rounded-md bg-emerald-50 text-emerald-700 px-2 py-1">{g}</span>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-3">Merges are blocked when critical quality gates fail.</p>
      </Section>

      <Section icon={<Bot className="w-5 h-5 text-primary" />} title="AI-Assisted Development Standards">
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
          {aiDevStandards.map((s) => (
            <p key={s} className="text-sm text-stone-600 px-5 py-2.5">{s}</p>
          ))}
        </div>
      </Section>

      <Section icon={<Gauge className="w-5 h-5 text-primary" />} title="Engineering Metrics">
        <div className="flex flex-wrap gap-1.5">
          {metrics.map((m) => (
            <span key={m} className="text-xs rounded-md bg-stone-100 text-stone-600 px-2 py-1">{m}</span>
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-3">Metrics improve processes — never evaluate individual developers in isolation.</p>
      </Section>

      <Section icon={<Wrench className="w-5 h-5 text-primary" />} title="Developer Experience (DX) Platform">
        <div className="grid sm:grid-cols-2 gap-2">
          {dxPlatform.map((d) => (
            <p key={d} className="text-sm text-stone-600 flex gap-2"><span className="text-primary">›</span>{d}</p>
          ))}
        </div>
      </Section>
    </div>
  );
}