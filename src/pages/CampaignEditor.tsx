/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function CampaignEditor({ campaignId, userId, onBack }: { campaignId: string; userId: string; onBack: () => void }) {
  const campaign = useQuery(api.userCampaigns.getCampaign, { campaignId });
  const updates = useQuery(api.userCampaigns.getCampaignUpdates, { campaignId });
  const updateCampaign = useMutation(api.userCampaigns.updateCampaign);
  const addUpdate = useMutation(api.userCampaigns.addCampaignUpdate);
  const recordDonation = useMutation(api.userCampaigns.recordDonation);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [story, setStory] = useState("");
  const [category, setCategory] = useState("Community");
  const [goalAmount, setGoalAmount] = useState("");
  const [status, setStatus] = useState("draft");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [cashappTag, setCashappTag] = useState("");
  const [outreachEnabled, setOutreachEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Update form state
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateContent, setUpdateContent] = useState("");

  // Ownership check
  const isOwner = campaign?.ownerUserId === userId;

  useEffect(() => {
    if (campaign) {
      setTitle(campaign.title || "");
      setSummary(campaign.summary || "");
      setStory(campaign.story || "");
      setCategory(campaign.category || "Community");
      setGoalAmount(String(campaign.goalAmount || ""));
      setStatus(campaign.status || "draft");
      setCoverImageUrl(campaign.coverImageUrl || "");
      setCashappTag(campaign.cashappTag || "");
      setOutreachEnabled(campaign.outreachEnabled || false);
    }
  }, [campaign]);

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg("");
    const result = await updateCampaign({
      campaignId,
      userId,
      title,
      summary,
      story,
      category,
      goalAmount: parseFloat(goalAmount) || 0,
      coverImageUrl: coverImageUrl || undefined,
      cashappTag: cashappTag || undefined,
      status,
      outreachEnabled,
    });
    if (result.success) {
      setSavedMsg("Saved!");
      setTimeout(() => setSavedMsg(""), 2000);
    } else {
      setSavedMsg(result.error || "Failed to save");
    }
    setSaving(false);
  };

  const handleAddUpdate = async () => {
    if (!updateTitle.trim() || !updateContent.trim()) return;
    await addUpdate({ campaignId, userId, title: updateTitle, content: updateContent });
    setUpdateTitle("");
    setUpdateContent("");
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="card text-center py-8">
        <p className="text-sm text-ifred font-semibold">Access Denied</p>
        <p className="text-xs text-ifmuted mt-1">You can only edit campaigns you own.</p>
        <button onClick={onBack} className="btn-primary mt-4">Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs text-ifmuted">&larr; Back</button>
        <span className="text-sm font-semibold text-iftext">Edit Campaign</span>
        {savedMsg && <span className="text-[10px] text-ifgreen ml-auto">{savedMsg}</span>}
      </div>

      {/* Basic info */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-iftext">Campaign Details</h3>
        <div>
          <label className="text-[10px] text-ifmuted mb-1 block">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-[10px] text-ifmuted mb-1 block">Summary</label>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="input-field min-h-[60px]" />
        </div>
        <div>
          <label className="text-[10px] text-ifmuted mb-1 block">Story</label>
          <textarea value={story} onChange={(e) => setStory(e.target.value)} className="input-field min-h-[120px]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-ifmuted mb-1 block">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
              <option>Community</option><option>Education</option><option>Medical</option>
              <option>Emergency</option><option>Animals</option><option>Environment</option>
              <option>Technology</option><option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-ifmuted mb-1 block">Goal ($)</label>
            <input type="number" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} className="input-field" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-ifmuted mb-1 block">Cover Image URL</label>
          <input type="text" placeholder="https://..." value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-[10px] text-ifmuted mb-1 block">CashApp Tag</label>
          <input type="text" placeholder="$username" value={cashappTag} onChange={(e) => setCashappTag(e.target.value)} className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-ifmuted mb-1 block">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-iftext cursor-pointer">
              <input type="checkbox" checked={outreachEnabled} onChange={(e) => setOutreachEnabled(e.target.checked)} className="w-4 h-4 accent-ifaccent" />
              Outreach enabled
            </label>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Campaign stats */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Campaign Stats</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-ifcyan">${campaign.raisedAmount?.toLocaleString()}</p>
            <p className="text-[10px] text-ifmuted">Raised</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ifaccent">${campaign.goalAmount?.toLocaleString()}</p>
            <p className="text-[10px] text-ifmuted">Goal</p>
          </div>
          <div>
            <p className="text-lg font-bold text-ifgreen">{campaign.donorCount}</p>
            <p className="text-[10px] text-ifmuted">Donors</p>
          </div>
        </div>
      </div>

      {/* Updates section */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-iftext">Campaign Updates</h3>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Update title"
            value={updateTitle}
            onChange={(e) => setUpdateTitle(e.target.value)}
            className="input-field"
          />
          <textarea
            placeholder="Share an update with your supporters..."
            value={updateContent}
            onChange={(e) => setUpdateContent(e.target.value)}
            className="input-field min-h-[80px]"
          />
          <button onClick={handleAddUpdate} className="btn-primary w-full text-sm">Post Update</button>
        </div>

        {updates && updates.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-ifborder">
            {updates.map((u) => (
              <div key={u._id} className="bg-ifdark rounded-lg p-2">
                <p className="text-xs font-semibold text-iftext">{u.title}</p>
                <p className="text-[10px] text-ifmuted mt-0.5">{u.content}</p>
                <p className="text-[10px] text-ifmuted mt-1">{new Date(u.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
