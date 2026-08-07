/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function MissionBriefs() {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("executive");
  const [summary, setSummary] = useState("");
  const [metrics, setMetrics] = useState("");
  const [actionItems, setActionItems] = useState("");

  const briefs = useQuery(api.agentOps.getAllBriefs, {});
  const createBrief = useMutation(api.agentOps.createBrief);
  const publishBrief = useMutation(api.agentOps.publishBrief);

  const handleCreate = async () => {
    if (!title.trim() || !summary.trim()) return;
    await createBrief({
      title,
      type,
      author: "Solene",
      summary,
      metrics: metrics || undefined,
      actionItems: actionItems || undefined,
    });
    setTitle("");
    setSummary("");
    setMetrics("");
    setActionItems("");
    setShowCreate(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-iftext">Mission Briefs</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="text-xs text-ifaccent">
          + New
        </button>
      </div>

      {showCreate && (
        <div className="card space-y-3">
          <input type="text" placeholder="Brief title" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
            <option value="daily">Daily Report</option>
            <option value="weekly">Weekly Summary</option>
            <option value="executive">Executive Brief</option>
            <option value="ad_hoc">Ad Hoc</option>
          </select>
          <textarea placeholder="Summary..." value={summary} onChange={(e) => setSummary(e.target.value)} className="input-field min-h-[100px]" />
          <textarea placeholder="Key metrics (JSON format)" value={metrics} onChange={(e) => setMetrics(e.target.value)} className="input-field min-h-[60px]" />
          <textarea placeholder="Action items (JSON array)" value={actionItems} onChange={(e) => setActionItems(e.target.value)} className="input-field min-h-[60px]" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary flex-1">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm">Cancel</button>
          </div>
        </div>
      )}

      {!briefs && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {briefs && briefs.length === 0 && (
        <div className="card text-center py-6">
          <p className="text-xs text-ifmuted">No mission briefs yet.</p>
        </div>
      )}
      {briefs?.map((b: any) => (
        <div key={b._id} className="card space-y-2">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-iftext">{b.title}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              b.status === "published" ? "bg-ifgreen/20 text-ifgreen" :
              b.status === "draft" ? "bg-ifamber/20 text-ifamber" :
              "bg-ifborder text-ifmuted"
            }`}>
              {b.status}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-ifaccent/10 text-ifaccent text-[10px]">{b.type}</span>
          <p className="text-xs text-ifmuted">{b.summary}</p>
          {b.metrics && (
            <div className="bg-ifcard rounded-lg p-2">
              <p className="text-[10px] text-ifmuted uppercase">Metrics</p>
              <p className="text-xs text-iftext font-mono">{b.metrics}</p>
            </div>
          )}
          {b.actionItems && (
            <div className="bg-ifcard rounded-lg p-2">
              <p className="text-[10px] text-ifmuted uppercase">Action Items</p>
              <p className="text-xs text-iftext">{b.actionItems}</p>
            </div>
          )}
          <div className="flex justify-between items-center">
            <p className="text-[10px] text-ifmuted">By {b.author} · {new Date(b.createdAt).toLocaleDateString()}</p>
            {b.status === "draft" && (
              <button
                onClick={() => publishBrief({ briefId: b._id })}
                className="text-[10px] text-ifgreen font-medium"
              >
                Publish
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
