import React from "react";
import { AlertTriangle } from "lucide-react";
import { PRELAUNCH_HEADLINE, PRELAUNCH_NOTICE, PRELAUNCH_PAYMENT_NOTICE } from "@/lib/prelaunch";

export default function PrelaunchNotice({ compact = false, payment = false, className = "" }) {
  return (
    <div role="status" aria-label="Campaign donations paused notice" className={`rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 ${compact ? "p-3" : "p-4 sm:p-5"} ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`${compact ? "w-4 h-4" : "w-5 h-5"} mt-0.5 shrink-0 text-amber-700`} aria-hidden="true" />
        <div>
          <p className={`font-bold tracking-wide ${compact ? "text-xs" : "text-sm sm:text-base"}`}>{PRELAUNCH_HEADLINE}</p>
          <p className={`mt-1 leading-relaxed ${compact ? "text-xs" : "text-sm"}`}>{payment ? PRELAUNCH_PAYMENT_NOTICE : PRELAUNCH_NOTICE}</p>
        </div>
      </div>
    </div>
  );
}