import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CAPABILITY_MODULES } from "./onboardingSteps";
import { CheckCircle2, Clock, Link2, ShieldQuestion } from "lucide-react";

const STATUS_META = {
  connected: { label: "Connected", icon: CheckCircle2, tone: "text-emerald-600" },
  available: { label: "Available", icon: Link2, tone: "text-primary" },
  coming_soon: { label: "Coming soon", icon: Clock, tone: "text-stone-400" },
  verify_runtime: { label: "Verify status", icon: ShieldQuestion, tone: "text-amber-600" },
};

export default function ConnectStep({ data, onChange }) {
  // Remove stale selections for a retired payment provider.
  const selected = (data.platforms || []).filter(id => id !== 'stripe');
  const [paymentCapabilities, setPaymentCapabilities] = useState(null);

  useEffect(() => {
    let cancelled = false;
    base44.functions.invoke("getPaymentCapabilities", {})
      .then(({ data: capabilities }) => { if (!cancelled) setPaymentCapabilities(capabilities || null); })
      .catch(() => { if (!cancelled) setPaymentCapabilities(null); });
    return () => { cancelled = true; };
  }, []);

  const runtimeStatus = (item) => {
    if (item.id === "paypal") {
      if (!paymentCapabilities) return "verify_runtime";
      return paymentCapabilities.paypal?.donation_link_available || paymentCapabilities.paypal?.api_configured
        ? "available"
        : "verify_runtime";
    }
    return item.status;
  };

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((p) => p !== id)
      : [...selected, id];
    onChange({ ...data, platforms: next });
  };

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">Connect your fundraising world</h2>
      <p className="text-stone-600 mb-6">
        Link external crowdfunding platforms and social channels so the AI Growth Engine can unify donor
        discovery, publishing, and monitoring. Select the ones you use — connections authorize later from
        Mission Control.
      </p>
      <div className="space-y-5">
        {CAPABILITY_MODULES.map((group) => (
          <div key={group.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">{group.group}</p>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map((item) => {
                const status = runtimeStatus(item);
                const meta = STATUS_META[status] || STATUS_META.verify_runtime;
                const Icon = meta.icon;
                const isSelected = selected.includes(item.id);
                const disabled = status === "coming_soon";
                return (
                  <button key={item.id} type="button" disabled={disabled} onClick={() => toggle(item.id)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm text-left transition-colors ${isSelected ? "border-primary bg-primary/10" : "border-slate-200 bg-white hover:border-slate-300"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
                    <span className="text-stone-800">{item.label}</span>
                    <span className={`flex items-center gap-1 text-xs ${meta.tone}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {status === "connected" ? meta.label : isSelected ? "Selected" : meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
