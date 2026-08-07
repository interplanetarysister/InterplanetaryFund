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
  onNavigate?: (view: string) => void;
};

type TabName = "campaigns" | "following" | "notifications" | "withdrawals";

export default function UserDashboard({ userId, userName, onLogout, onEditCampaign, onNavigate }: UserDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabName>("campaigns");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const myCampaigns = useQuery(api.userCampaigns.getMyCampaigns, { userId });
  const notifications = useQuery(api.userCampaigns.getNotifications, { userId });
  const markAllRead = useMutation(api.comments.markAllNotificationsRead);
  const followed = useQuery(api.userCampaigns.getFollowedCampaigns, { userId });
  const payoutHistory = useQuery(api.userCampaigns.getPayoutHistory, { userId });

  // Create form state
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [story, setStory] = useState("");
  const [category, setCategory] = useState("Community");
  const [goalAmount, setGoalAmount] = useState("");
  const createCampaign = useMutation(api.userCampaigns.createCampaign);

  // Withdrawal form state
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("cashapp");
  const [payoutDestination, setPayoutDestination] = useState("");
  const [withdrawResult, setWithdrawResult] = useState<any>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const requestPayout = useMutation(api.userCampaigns.requestPayout);

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

  const handleWithdraw = async () => {
    if (!selectedCampaignId || !withdrawAmount || !payoutDestination.trim()) return;
    setWithdrawError(null);
    setWithdrawResult(null);
    try {
      const result = await requestPayout({
        campaignId: selectedCampaignId,
        userId,
        amount: parseFloat(withdrawAmount),
        payoutMethod,
        payoutDestination,
      });
      if (result.success) {
        setWithdrawResult(result);
        setWithdrawAmount("");
        setPayoutDestination("");
      } else {
        setWithdrawError(result.error || "Withdrawal failed");
      }
    } catch (e: any) {
      setWithdrawError(e.message || "Something went wrong");
    }
  };

  const unreadCount = notifications?.length || 0;
  const activeCampaigns = myCampaigns?.filter((c) => c.raisedAmount > 0) || [];

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
        <TabButton active={activeTab === "campaigns"} onClick={() => setActiveTab("campaigns")} label="My Missions" />
        <TabButton active={activeTab === "withdrawals"} onClick={() => setActiveTab("withdrawals")} label="Withdrawals" />
        <TabButton active={activeTab === "following"} onClick={() => setActiveTab("following")} label="Following" />
        <TabButton active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} label="Notifications" />
      </div>

      {/* === CAMPAIGNS TAB === */}
      {activeTab === "campaigns" && (
        <>
          <button
            onClick={() => onNavigate?.("aiwizard")}
            className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold"
          >
            🚀 Launch New Campaign with AI
          </button>

          {showCreateForm && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-iftext">New Campaign</h3>
              <input type="text" placeholder="Campaign title" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
              <textarea placeholder="Short summary (1-2 sentences)" value={summary} onChange={(e) => setSummary(e.target.value)} className="input-field min-h-[60px]" />
              <textarea placeholder="Full story" value={story} onChange={(e) => setStory(e.target.value)} className="input-field min-h-[120px]" />
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
              <input type="number" placeholder="Goal amount ($)" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} className="input-field" />
              <div className="flex gap-2">
                <button onClick={handleCreate} className="btn-primary flex-1">Create</button>
                <button onClick={() => setShowCreateForm(false)} className="px-4 py-2.5 rounded-xl border border-ifborder text-ifmuted text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-iftext">My Missions</h3>
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
                  <div className="h-full bg-ifaccent rounded-full" style={{ width: `${Math.min(100, (c.raisedAmount / c.goalAmount) * 100)}%` }} />
                </div>
                <button onClick={() => onEditCampaign(c.id)} className="w-full py-2 rounded-lg bg-ifcard border border-ifborder text-iftext text-xs font-medium">
                  Edit Campaign
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* === WITHDRAWALS TAB === */}
      {activeTab === "withdrawals" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-iftext">Request a Payout</h3>

          {activeCampaigns.length === 0 && (
            <div className="card text-center py-6">
              <p className="text-xs text-ifmuted">No campaigns with funds available for withdrawal yet.</p>
            </div>
          )}

          {activeCampaigns.length > 0 && (
            <div className="card space-y-3">
              {/* Campaign selector */}
              <div>
                <label className="text-[10px] text-ifmuted uppercase tracking-wide">Select Campaign</label>
                <select
                  value={selectedCampaignId || ""}
                  onChange={(e) => { setSelectedCampaignId(e.target.value); setWithdrawResult(null); setWithdrawError(null); }}
                  className="input-field"
                >
                  <option value="">Choose a campaign...</option>
                  {activeCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} — ${c.raisedAmount.toLocaleString()} raised
                    </option>
                  ))}
                </select>
              </div>

              {selectedCampaignId && (
                <>
                  {/* Amount input */}
                  <div>
                    <label className="text-[10px] text-ifmuted uppercase tracking-wide">Amount to Withdraw ($)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawResult(null); setWithdrawError(null); }}
                      className="input-field"
                    />
                  </div>

                  {/* Fee preview */}
                  {parseFloat(withdrawAmount) > 0 && (
                    <div className="bg-ifcard rounded-lg p-3 space-y-1 text-xs">
                      <div className="flex justify-between text-ifmuted">
                        <span>Available</span>
                        <span className="text-iftext font-medium">${parseFloat(withdrawAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-ifmuted">
                        <span>Platform fee (5%)</span>
                        <span>${(parseFloat(withdrawAmount) * 0.05).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-ifmuted">
                        <span>Processing (2.9% + $0.30)</span>
                        <span>${(parseFloat(withdrawAmount) * 0.029 + 0.30).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-ifborder pt-1">
                        <span className="text-iftext font-semibold">You receive</span>
                        <span className="text-ifaccent font-bold">
                          ${(parseFloat(withdrawAmount) - (parseFloat(withdrawAmount) * 0.05) - (parseFloat(withdrawAmount) * 0.029 + 0.30)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Payout method */}
                  <div>
                    <label className="text-[10px] text-ifmuted uppercase tracking-wide">Payout Method</label>
                    <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)} className="input-field">
                      <option value="cashapp">CashApp ($Cashtag)</option>
                      <option value="paypal">PayPal (Email)</option>
                    </select>
                  </div>

                  {/* Destination */}
                  <div>
                    <label className="text-[10px] text-ifmuted uppercase tracking-wide">
                      {payoutMethod === "cashapp" ? "$Cashtag" : "PayPal Email"}
                    </label>
                    <input
                      type="text"
                      placeholder={payoutMethod === "cashapp" ? "$yourtag" : "you@email.com"}
                      value={payoutDestination}
                      onChange={(e) => setPayoutDestination(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  {/* Error / success */}
                  {withdrawError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-400">
                      {withdrawError}
                    </div>
                  )}
                  {withdrawResult && (
                    <div className="bg-ifgreen/10 border border-ifgreen/30 rounded-lg p-2 text-xs text-ifgreen">
                      Payout requested! You'll receive {withdrawResult.display?.youReceive || `$${withdrawResult.netAmount?.toFixed(2)}`}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleWithdraw}
                    disabled={!withdrawAmount || !payoutDestination.trim() || parseFloat(withdrawAmount) <= 0}
                    className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Request Payout
                  </button>
                </>
              )}
            </div>
          )}

          {/* Payout history */}
          {payoutHistory && payoutHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-iftext">Payout History</h3>
              {payoutHistory.map((p: any) => (
                <div key={p._id} className="card space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-iftext">${p.amountRequested.toFixed(2)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.status === "completed" ? "bg-ifgreen/20 text-ifgreen" :
                      p.status === "pending_admin_review" ? "bg-ifamber/20 text-ifamber" :
                      "bg-ifborder text-ifmuted"
                    }`}>
                      {p.status === "pending_admin_review" ? "Pending Review" : p.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-ifmuted">
                    {p.payoutMethod} → {p.payoutDestination} | Net: ${p.netAmount.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-ifmuted">
                    Requested {new Date(p.requestedDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === FOLLOWING TAB === */}
      {activeTab === "following" && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-iftext">Following</h3>
          {followed && followed.length === 0 && (
            <div className="card text-center py-6">
              <p className="text-xs text-ifmuted">Not following any campaigns yet.</p>
            </div>
          )}
          {followed?.map((f) => (
            <div key={f._id} className="card flex items-center gap-2">
              {f.coverImageUrl && <img src={f.coverImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
              <p className="text-xs text-iftext font-medium">{f.campaignTitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* === NOTIFICATIONS TAB === */}
      {activeTab === "notifications" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-iftext">Notifications</h3>
            {notifications && notifications.length > 0 && (
              <button
                onClick={() => markAllRead({ userId })}
                className="text-[10px] text-ifaccent hover:text-cyan-400"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications && notifications.length === 0 && (
            <div className="card text-center py-6">
              <p className="text-xs text-ifmuted">No notifications.</p>
            </div>
          )}
          {notifications?.map((n: any) => (
            <div key={n._id} className={`card ${!n.read ? "border-ifaccent/40" : ""}`}>
              <p className="text-xs text-iftext">{n.body || n.message}</p>
              <p className="text-[10px] text-ifmuted mt-1">{new Date(n.createdAt || n.createdDate || Date.now()).toLocaleDateString()}</p>
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
