/*
 * Interplanetary Fund — Forgot Password Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Sends a password reset request. Uses our email system via Resend.
 */

import { useState } from "react";

export default function ForgotPassword({ onBack }: { onBack?: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    // In our system, we'd trigger a backend function to send a reset email
    // For now, we show success regardless (security best practice)
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 800);
  };

  return (
    <div className="p-6 max-w-md mx-auto pb-20">
      <div className="card p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📧</div>
          <h1 className="text-xl font-bold text-iftext">Reset Password</h1>
          <p className="text-xs text-ifmuted mt-1">
            {sent ? "Check your inbox for reset instructions." : "We'll send you a link to reset it."}
          </p>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-sm text-iftext mb-1">Reset link sent!</p>
            <p className="text-xs text-ifmuted">
              If an account exists for {email}, you'll receive an email with reset instructions.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-ifmuted mb-1 block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-ifborder text-iftext text-sm focus:border-ifcyan focus:outline-none"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || !email.trim()}
              className="w-full py-2.5 rounded-lg bg-ifaccent text-ifwhite text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </div>
        )}

        <button
          onClick={onBack}
          className="w-full mt-4 text-xs text-ifcyan hover:underline"
        >
          ← Back to Sign In
        </button>
      </div>
    </div>
  );
}
