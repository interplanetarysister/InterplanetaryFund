/*
 * Interplanetary Fund — User Settings Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState } from "react";

export default function Settings({ userId, userName }: { userId: string | null; userName: string }) {
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);

  if (!userId) {
    return (
      <div className="p-6 max-w-3xl mx-auto pb-20">
        <div className="text-center py-20">
          <div className="text-5xl mb-4">⚙️</div>
          <p className="text-zinc-400">Sign in to manage your settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Account</p>
        <h1 className="text-3xl font-bold text-iftext">Settings</h1>
      </div>

      {/* Profile section */}
      <div className="mb-6 p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">👤</span>
          <h2 className="text-sm font-semibold text-iftext">Profile</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500">Display Name</label>
            <input
              type="text"
              value={userName}
              readOnly
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-iftext"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Account ID</label>
            <input
              type="text"
              value={userId}
              readOnly
              className="w-full mt-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Notifications section */}
      <div className="mb-6 p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">🔔</span>
          <h2 className="text-sm font-semibold text-iftext">Notifications</h2>
        </div>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-zinc-300">Push notifications</span>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-11 h-6 rounded-full transition-colors ${notifications ? "bg-ifcyan" : "bg-zinc-700"}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${notifications ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-zinc-300">Email updates</span>
            <button
              onClick={() => setEmailUpdates(!emailUpdates)}
              className={`w-11 h-6 rounded-full transition-colors ${emailUpdates ? "bg-ifcyan" : "bg-zinc-700"}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${emailUpdates ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </label>
        </div>
      </div>

      {/* Privacy section */}
      <div className="mb-6 p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">🛡️</span>
          <h2 className="text-sm font-semibold text-iftext">Privacy</h2>
        </div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-zinc-300">Public profile</span>
          <button
            onClick={() => setPublicProfile(!publicProfile)}
            className={`w-11 h-6 rounded-full transition-colors ${publicProfile ? "bg-ifcyan" : "bg-zinc-700"}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full transition-transform ${publicProfile ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </label>
      </div>

      {/* About section */}
      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">🌍</span>
          <h2 className="text-sm font-semibold text-iftext">About</h2>
        </div>
        <p className="text-xs text-zinc-500">Interplanetary Fund v1.0</p>
        <p className="text-xs text-zinc-500 mt-1">AI-Powered Fundraising Platform</p>
        <p className="text-xs text-zinc-600 mt-2">© 2026 Michelle Rogers. All Rights Reserved.</p>
      </div>
    </div>
  );
}
