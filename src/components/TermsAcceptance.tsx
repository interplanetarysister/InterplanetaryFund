/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState, useEffect } from "react";

const TERMS_KEY = "if_terms_accepted_v1";
const TERMS_DATE = "August 3, 2026";

export function TermsAcceptance({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(TERMS_KEY);
    if (stored === "true") setAccepted(true);
  }, []);

  const accept = () => {
    localStorage.setItem(TERMS_KEY, "true");
    setAccepted(true);
  };

  if (accepted) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[60] bg-ifdark flex items-center justify-center p-4 overflow-y-auto">
      <div className="max-w-md w-full bg-ifcard rounded-2xl p-6 border border-ifborder glow-card my-auto">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-xl bg-ifaccent flex items-center justify-center text-ifwhite font-bold text-xl mx-auto mb-3 shadow-glow-purple">IF</div>
          <h2 className="text-lg font-bold text-iftext">Terms of Service</h2>
        </div>
        <p className="text-ifmuted text-sm mb-4">
          By using Interplanetary Fund, you agree to our Terms of Service and
          Privacy Policy (last updated {TERMS_DATE}).
        </p>
        <div className="text-ifmuted text-xs mb-5 space-y-1.5">
          <p>The platform is provided "AS IS" without warranties of any kind.</p>
          <p>Michelle Rogers is not liable for losses exceeding $50 per claim.</p>
          <p>Users assume all risk. Donations are voluntary and may not reach campaign goals.</p>
          <p>The Interplanetary Fund name and code are proprietary — copying is prohibited.</p>
        </div>
        <button
          onClick={accept}
          className="btn-primary"
        >
          I Agree — Continue
        </button>
      </div>
    </div>
  );
}
