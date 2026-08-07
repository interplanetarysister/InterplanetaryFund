/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const ROLE_COLORS: Record<string, string> = {
  fundraising: "badge-cyan",
  story: "badge-pink",
  donor_relations: "badge-green",
  protocol: "badge-red",
  analytics: "badge-purple",
  treasury: "badge-amber",
  platform_sync: "badge-green",
};

export default function Agents() {
  const agents = useQuery(api.agents.getAgents, {});

  if (!agents) {
    return <div className="text-center text-ifmuted py-20">Loading agents...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Agent Roster</h2>
        <p className="page-subtitle">{agents.length} agents · All credit-free</p>
      </div>

      {agents.map((a: any) => (
        <div key={a._id} className="card space-y-3">
          {/* Agent Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: a.accentColor || "#8b5cf6" }}
              >
                {a.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-iftext">{a.name}</h3>
                <p className="text-[10px] text-ifmuted">{a.specialization}</p>
              </div>
            </div>
            <span className={`badge ${ROLE_COLORS[a.role] || "badge-muted"}`}>
              {a.status === "active" ? "● Active" : "○ Inactive"}
            </span>
          </div>

          {/* Purpose */}
          <p className="text-xs text-ifmuted leading-relaxed">{a.purpose}</p>

          {/* Scores */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-ifdark rounded-lg py-2">
              <p className="text-sm font-bold text-ifaccent">{a.trustScore}</p>
              <p className="text-[9px] text-ifmuted">Trust</p>
            </div>
            <div className="bg-ifdark rounded-lg py-2">
              <p className="text-sm font-bold text-ifgreen">{a.reliabilityScore}</p>
              <p className="text-[9px] text-ifmuted">Reliable</p>
            </div>
            <div className="bg-ifdark rounded-lg py-2">
              <p className="text-sm font-bold text-ifcyan">{a.efficiencyScore}</p>
              <p className="text-[9px] text-ifmuted">Efficient</p>
            </div>
            <div className="bg-ifdark rounded-lg py-2">
              <p className="text-sm font-bold text-ifpink">{a.collaborationScore}</p>
              <p className="text-[9px] text-ifmuted">Collab</p>
            </div>
          </div>

          {/* Task Stats */}
          <div className="flex gap-3 text-xs">
            <span className="text-ifgreen">✓ {a.successfulOutcomes} success</span>
            <span className="text-ifred">✗ {a.failedOutcomes} failed</span>
            <span className="text-ifmuted">{a.tasksCompleted} total tasks</span>
          </div>

          {/* Capabilities */}
          <div className="flex flex-wrap gap-1">
            {a.capabilities.slice(0, 4).map((cap: string) => (
              <span key={cap} className="badge badge-muted">{cap}</span>
            ))}
            {a.capabilities.length > 4 && (
              <span className="badge badge-muted">+{a.capabilities.length - 4}</span>
            )}
          </div>

          {/* Working Memory */}
          {a.workingMemory && a.workingMemory.length > 0 && (
            <div className="pt-2 border-t border-ifborder">
              <p className="text-[10px] text-ifmuted font-medium mb-1">Working Memory</p>
              {a.workingMemory.map((mem: string, i: number) => (
                <p key={i} className="text-[10px] text-iftext bg-ifdark rounded px-2 py-1 mb-1">
                  {mem}
                </p>
              ))}
            </div>
          )}

          {/* Long-Term Memory */}
          {a.longTermMemory && a.longTermMemory.length > 0 && (
            <div>
              <p className="text-[10px] text-ifmuted font-medium mb-1">Long-Term Memory</p>
              {a.longTermMemory.slice(-2).map((mem: string, i: number) => (
                <p key={i} className="text-[10px] text-ifmuted bg-ifdark rounded px-2 py-1 mb-1">
                  {mem}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
