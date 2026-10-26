import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";

const prefDefs = [
  { key: "email_updates", label: "Email messages", hint: "Campaign updates, thank-yous, and announcements by email" },
  { key: "in_app_updates", label: "In-app notifications", hint: "Messages from organizers in your notification center" },
];

export default function CommPreferences() {
  const [prefs, setPrefs] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.auth.me().then((me) => setPrefs(me.comm_prefs || {}));
  }, []);

  if (!prefs) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const toggle = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await base44.auth.updateMe({ comm_prefs: next });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5 sm:p-6">
      <p className="text-sm text-stone-500 mb-5">
        Control how organizers of campaigns you support can reach you. Your choices are always respected.
      </p>
      <div className="space-y-5">
        {prefDefs.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-stone-900">{label}</Label>
              <p className="text-xs text-stone-400 mt-0.5">{hint}</p>
            </div>
            <Switch checked={prefs[key] !== false} onCheckedChange={(v) => toggle(key, v)} />
          </div>
        ))}
      </div>
      {saved && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 mt-4"><Check className="w-3.5 h-3.5" /> Preferences saved</p>
      )}
    </div>
  );
}