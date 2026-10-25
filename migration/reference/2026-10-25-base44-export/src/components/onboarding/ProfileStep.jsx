import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FUNDRAISING_GOALS } from "./onboardingSteps";

export default function ProfileStep({ data, onChange }) {
  return (
    <div className="max-w-md mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">Tell us about your mission</h2>
      <p className="text-stone-600 mb-6">This personalizes how Mission Control assists you.</p>
      <div className="space-y-4">
        <div>
          <Label className="mb-1.5 block">Display name</Label>
          <Input
            value={data.full_name || ""}
            onChange={(e) => onChange({ ...data, full_name: e.target.value })}
            placeholder="Your name or organization"
          />
        </div>
        <div>
          <Label className="mb-1.5 block">What are you fundraising for?</Label>
          <div className="grid grid-cols-2 gap-2">
            {FUNDRAISING_GOALS.map((g) => {
              const active = data.goal === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onChange({ ...data, goal: g.id })}
                  className={`rounded-xl border px-3 py-2.5 text-sm text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}