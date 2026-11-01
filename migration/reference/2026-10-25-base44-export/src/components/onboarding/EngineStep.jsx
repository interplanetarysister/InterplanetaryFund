import React from "react";
import { Compass, Sparkles, Zap, LifeBuoy } from "lucide-react";
import { ENGINE_CAPABILITIES } from "./onboardingSteps";

const ICONS = { Compass, Sparkles, Zap, LifeBuoy };

export default function EngineStep() {
  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">Meet the AI Growth Engine</h2>
      <p className="text-stone-600 mb-6">
        Mission Control is your central intelligence hub. It's a core feature of Interplanetary Fund — not an optional tool —
        and it works across every campaign you run.
      </p>
      <div className="space-y-3">
        {ENGINE_CAPABILITIES.map((c) => {
          const Icon = ICONS[c.icon] || Sparkles;
          return (
            <div key={c.id} className="flex gap-3 bg-white rounded-xl border border-stone-200 p-4">
              <span className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary" />
              </span>
              <div>
                <p className="font-medium text-stone-800 text-sm">{c.title}</p>
                <p className="text-xs text-stone-500">{c.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}