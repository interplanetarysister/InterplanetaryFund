/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useQuery, useMutation } from "convex/react";
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
  const sessionToken = typeof window !== "undefined" ? sessionStorage.getItem("if_admin_session") || "" : "";
  const agents = useQuery(api.agents.getAdminAgents, sessionToken ? { sessionToken } : "skip");
  const automationStatus = useQuery(api.agentAutomation.getAutomationStatus, {});
  const toggleAutomation = useMutation(api.agentAutomation.toggleAgentAutomation);

  if (!agents) {
    return <div className="text-center text-ifmuted py-20">Loading agents...</div>;
  }

  const autoMap = new Map<string, any>();
  if (automationStatus) {
    for (const a of automationStatus) {
      autoMap.set(a.name, a);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Agent Roster</h2>
        <p className="page-subtitle">
          {agents.length} agents · All credit-free ·{" "}
          {automationStatus ? `${automationStatus.filter(a => a.automationEnabled).length} automated` : "loading..."}
        </p>
      </div>

      {/* Master Automation Summary */}
      {automationStatus && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-iftext">Automation Overview</h3>
              <p className="text-[10px] text-ifmuted">
                Each agent runs on its own schedule. Toggle individual agents on or off below.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="badge badge-green">
                {automationStatus.filter(a => a.automationEnabled).length} ON
              </span>
              <span className="badge badge-muted">
                {automationStatus.filter(a => !a.automationEnabled).length} OFF
              </span>
            </div>
          </div>
        </div>
      )}

      {agents.map((a: any) => {
        const auto = autoMap.get(a.name);
        const isEnabled = auto?.automationEnabled ?? true;

        return (
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
              <div className="flex flex-col items-end gap-1">
                <span className={`badge ${ROLE_COLORS[a.role] || "badge-muted"}`}>
                  {a.status === "active" ? "● Active" : "○ Inactive"}
                </span>
                {auto && (
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                    isEnabled
                      ? "bg-ifgreen/20 text-ifgreen"
                      : "bg-ifborder text-ifmuted"
                  }`}>
                    {isEnabled ? "● Auto ON" : "○ Auto OFF"}
                  </span>
                )}
              </div>
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

            {/* Task Stats + Automation Info */}
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="text-ifgreen">✓ {a.successfulOutcomes} success</span>
              <span className="text-ifred">✗ {a.failedOutcomes} failed</span>
              <span className="text-ifmuted">{a.tasksCompleted} total tasks</span>
              {auto?.automationInterval && (
                <span className="text-ifaccent">⏱ {auto.automationInterval}</span>
              )}
            </div>

            {/* Automation Toggle + Last Run */}
            {auto && (
              <div className="pt-2 border-t border-ifborder space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-ifmuted font-medium">Automated Work</p>
                    <p className="text-[9px] text-ifmuted">
                      Last run: {auto.lastAutomationRun && auto.lastAutomationRun !== "never"
                        ? new Date(auto.lastAutomationRun).toLocaleString()
                        : "never"}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await toggleAutomation({ sessionToken, agentName: a.name, enabled: !isEnabled });
                    }}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${
                      isEnabled
                        ? "bg-ifgreen/20 text-ifgreen border border-ifgreen/30"
                        : "bg-ifaccent text-white border border-ifaccent"
                    }`}
                  >
                    {isEnabled ? "● Automation ON" : "○ Turn On Automation"}
                  </button>
                </div>
                {isEnabled ? (
                  <p className="text-[9px] text-ifmuted">
                    This agent is running automated tasks on its schedule. Turn off to pause all automated work.
                  </p>
                ) : (
                  <p className="text-[9px] text-ifmuted">
                    Automation is paused. The agent will not run any scheduled tasks until turned back on.
                  </p>
                )}
              </div>
            )}

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
        );
      })}
    </div>
  );
}
