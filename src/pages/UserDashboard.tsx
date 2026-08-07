/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type UserDashboardProps = {
  userId: string;
  userName: string;
  onLogout: () => void;
  onEditCampaign: (campaignId: string) => void;
};

export default function UserDashboard({ userId, userName, onLogout, onEditCampaign }: UserDashboardProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const myCampaigns = useQuery(api.userCampaigns.getMyCampaigns, { userId });
  const notifications = useQuery(api.userCampaigns.getNotifications, { userId });
  const followed = useQuery(api.userCampaigns.getFollowedCampaigns, { userId });

  // Create form state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [story, setStory] = useState("");
  const [category, setCategory] = useState("Community");
  const [goalAmount, setGoalAmount] = useState("");
  const createCampaign = useMutation(api.userCampaigns.createCampaign);

  const handleCreate = async () => {
    if (!title.trim() || !summary.trim() || !goalAmount) return;
    await createCampaign({
      userId,
      title,
      summary,
      story,
      category,
      goalAmount: parseFloat(goalAmount) || 0,
    });
    setTitle("");
    setSummary("");
    setStory("");
    setGoalAmount("");
    setShowCreateForm(false);
  };

  const unreadCount = notifications?.length || 0;

  return (
    <div className="space-y-4">
      {/* User header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-iftext">{userName}</p>
          <p className="text-[10px] text-ifmuted">Pilot Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-ifaccent/20 text-ifaccent text-[10px] font-medium">
              {unreadCount} new
            </span>
          )}
          <button onClick={onLogout} className="text-xs text-ifmuted">
            Sign out
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        <TabButton active={!showCreateForm} onClick={() => setShowCreateForm(false)} label="My Campaigns" />
        <TabButton active={false} onClick={() => {}} label="Following" />
        <TabButton active={false} onClick={() => {}} label="Notifications" />
      </div>

      {/* Create campaign button */}
      <button
        onClick={() => setShowCreateForm(!showCreateForm)}
        className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold"
      >
        + Launch New Campaign
      </button>

      {/* Create form */}
      {showCreateForm && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-iftext">New Campaign</h3>
          <input
            type="text"
            placeholder="Campaign title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
          />
          <textarea
            placeholder="Short summary (1-2 sentences)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="input-field min-h-[60px]"
          />
          <textarea
            placeholder="Full story — what makes this campaign compelling?"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            className="input-field min-h-[120px]"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            <option>Community</option>
            <option>Education</option>
            <option>Medical</option>
            <option>Emergency</option>
            <option>Animals</option>
            <option>Environment</option>
            <option>Technology</option>
            <option>Other</option>
          </select>
          <input
            type="number"
            placeholder="Goal amount ($)"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            className="input-field"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn-primary flex-1">Create</button>
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* My campaigns list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-iftext">My Campaigns</h3>
        {!myCampaigns && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {myCampaigns && myCampaigns.length === 0 && (
          <div className="card text-center py-6">
            <p className="text-xs text-ifmuted">No campaigns yet. Launch your first one!</p>
          </div>
        )}
        {myCampaigns?.map((c) => (
          <div key={c.id} className="card space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-iftext">{c.title}</p>
                <p className="text-[10px] text-ifmuted">{c.category}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                c.status === "active" ? "bg-ifgreen/20 text-ifgreen" :
                c.status === "draft" ? "bg-ifamber/20 text-ifamber" :
                "bg-ifborder text-ifmuted"
              }`}>
                {c.status}
              </span>
            </div>
            <p className="text-xs text-ifmuted">{c.summary}</p>
            <div className="flex justify-between text-xs">
              <span className="text-iftext font-medium">${c.raisedAmount.toLocaleString()}</span>
              <span className="text-ifmuted">of ${c.goalAmount.toLocaleString()}</span>
            </div>
            <div className="w-full h-1.5 bg-ifborder rounded-full overflow-hidden">
              <div
                className="h-full bg-ifaccent rounded-full"
                style={{ width: `${Math.min(100, (c.raisedAmount / c.goalAmount) * 100)}%` }}
              />
            </div>
            <button
              onClick={() => onEditCampaign(c.id)}
              className="w-full py-2 rounded-lg bg-ifcard border border-ifborder text-iftext text-xs font-medium"
            >
              Edit Campaign
            </button>
          </div>
        ))}
      </div>

      {/* Followed campaigns */}
      {followed && followed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-iftext">Following</h3>
          {followed.map((f) => (
            <div key={f._id} className="card flex items-center gap-2">
              {f.coverImageUrl && <img src={f.coverImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
              <p className="text-xs text-iftext font-medium">{f.campaignTitle}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
        active ? "bg-ifaccent text-white" : "bg-ifcard text-ifmuted border border-ifborder"
      }`}
    >
      {label}
    </button>
  );
}
