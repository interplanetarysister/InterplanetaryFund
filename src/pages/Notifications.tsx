/*
 * Interplanetary Fund — Notifications Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Based on fundforge/src/pages/Notifications.jsx — adapted for Convex backend.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Notifications({ userId }: { userId: string | null }) {
  const notifications = useQuery(
    api.userCampaigns.getNotifications,
    userId ? { userId } : "skip"
  );

  if (!userId) {
    return (
      <div className="p-6 max-w-3xl mx-auto pb-20">
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-zinc-400">Sign in to view your notifications.</p>
        </div>
      </div>
    );
  }

  if (notifications === undefined) {
    return (
      <div className="p-6 max-w-3xl mx-auto pb-20">
        <div className="flex items-center justify-center py-20">
          <div className="flex gap-2">
            <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" />
            <span className="w-2 h-2 rounded-full bg-ifaccent animate-pulse-glow" style={{ animationDelay: "0.2s" }} />
            <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    );
  }

  const unread = notifications.filter((n: any) => !n.read).length;

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-ifcyan mb-2">Inbox</p>
        <h1 className="text-3xl font-bold text-iftext">Notifications</h1>
        {unread > 0 && (
          <p className="text-zinc-400 text-sm mt-1">{unread} unread notification{unread !== 1 ? "s" : ""}</p>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 border border-zinc-800 rounded-2xl">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-zinc-400">No notifications yet.</p>
          <p className="text-zinc-500 text-sm mt-1">You'll see updates about your campaigns and donations here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <div
              key={n._id}
              className={`p-4 rounded-xl border transition-colors ${
                n.read
                  ? "bg-zinc-900/30 border-zinc-800"
                  : "bg-zinc-900/50 border-ifcyan/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-lg">
                  {n.type === "donation" ? "❤️" :
                   n.type === "follow" ? "👥" :
                   n.type === "update" ? "📢" :
                   n.type === "milestone" ? "🎉" :
                   n.type === "verification" ? "✓" :
                   "🔔"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-iftext">{n.title || "Notification"}</p>
                  {n.message && <p className="text-xs text-zinc-400 mt-1">{n.message}</p>}
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {new Date(n.createdAt || n._creationTime || 0).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-ifcyan shrink-0 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
