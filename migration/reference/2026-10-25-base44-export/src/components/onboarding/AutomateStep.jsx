import React from "react";
import { Switch } from "@/components/ui/switch";
import { Link2, Send, UserPlus, Wrench } from "lucide-react";

const CAPABILITIES = [
  { icon: Link2, title: "Connect your accounts", description: "IFund can continue supported connection steps after you choose a service." },
  { icon: UserPlus, title: "Help set up eligible accounts", description: "When a provider supports delegated setup, IFund can complete the allowed steps for you." },
  { icon: Send, title: "Share through connected accounts", description: "Your Publish actions can use verified connected destinations when the provider allows it." },
  { icon: Wrench, title: "Keep connections working", description: "IFund can verify, repair, and resume supported connections without inventing success." },
];

export default function AutomateStep({ data, onChange }) {
  const enabled = !!data.delegated_operations_enabled;
  const setEnabled = (value) => onChange({
    ...data,
    delegated_operations_enabled: value,
    automation: value ? { delegated_operations: true } : {},
  });

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="font-display text-2xl text-stone-900 mb-2">Would you like IFund to do supported steps for you?</h2>
      <p className="text-stone-600 mb-5">
        This is one revocable IFund permission. Outside services may still require their own sign-in,
        consent, identity check, or other provider-required step.
      </p>

      <div className="flex items-start justify-between gap-4 bg-white rounded-xl border border-stone-200 p-4 mb-5">
        <div>
          <p className="font-medium text-stone-900">Let IFund help me do things</p>
          <p className="text-xs text-stone-500 mt-1">
            {enabled
              ? "On — IFund may perform eligible connection, publishing, and maintenance steps when you direct it."
              : "Off — IFund will not perform delegated outside-account actions for you."}
          </p>
        </div>
        <Switch
          aria-label="Let IFund help me do things"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="space-y-3">
        {CAPABILITIES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-3 bg-white rounded-xl border border-stone-200 p-4">
            <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-stone-800 text-sm">{title}</p>
              <p className="text-xs text-stone-500 mt-0.5">{description}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500 mt-5">You can turn this permission off later from Connections.</p>
    </div>
  );
}
