/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function AgentActivity() {
  const recentActivity = useQuery(api.agentOps.getRecentActivity, { limit: 20 });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-iftext">Agent Activity Log</h3>
      {!recentActivity && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {recentActivity && recentActivity.length === 0 && (
        <div className="card text-center py-6">
          <p className="text-xs text-ifmuted">No agent activity logged yet.</p>
        </div>
      )}
      {recentActivity?.map((a: any) => (
        <div key={a._id} className="card space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-iftext">{a.agentName}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              a.category === "fundraising" ? "bg-ifcyan/20 text-ifcyan" :
              a.category === "story" ? "bg-pink-500/20 text-pink-400" :
              a.category === "donor" ? "bg-ifgreen/20 text-ifgreen" :
              a.category === "protocol" ? "bg-red-500/20 text-red-400" :
              a.category === "analytics" ? "bg-ifaccent/20 text-ifaccent" :
              a.category === "treasury" ? "bg-amber-500/20 text-amber-400" :
              "bg-ifborder text-ifmuted"
            }`}>
              {a.category}
            </span>
          </div>
          <p className="text-xs text-iftext">{a.action}</p>
          <p className="text-[10px] text-ifmuted">{a.description}</p>
          {a.creditCost !== undefined && a.creditCost > 0 && (
            <p className="text-[10px] text-amber-400">{a.creditCost} credits used</p>
          )}
          <p className="text-[10px] text-ifmuted">{new Date(a.timestamp).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
