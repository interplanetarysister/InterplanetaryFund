/*
 * Interplanetary Fund — Reset Password Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Allows user to set a new password using a reset token.
 */

import { useState } from "react";

export default function ResetPassword({ onComplete }: { onComplete?: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    // Would call backend function to reset password with token
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      setTimeout(() => onComplete?.(), 1500);
    }, 800);
  };

  if (done) {
    return (
      <div className="p-6 max-w-md mx-auto pb-20">
        <div className="card p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-iftext">Password Reset!</h1>
          <p className="text-xs text-ifmuted mt-1">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto pb-20">
      <div className="card p-6">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-xl font-bold text-iftext">New Password</h1>
          <p className="text-xs text-ifmuted mt-1">Choose a new password for your account</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-ifmuted mb-1 block">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-ifborder text-iftext text-sm focus:border-ifcyan focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-ifmuted mb-1 block">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-ifborder text-iftext text-sm focus:border-ifcyan focus:outline-none"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !password || !confirm}
            className="w-full py-2.5 rounded-lg bg-ifaccent text-ifwhite text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
