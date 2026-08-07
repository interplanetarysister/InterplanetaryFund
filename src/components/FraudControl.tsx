/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Fraud Control Panel — Super Admin only
 * Michelle can approve/deny payouts, freeze campaigns, and request ownership proof.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function FraudControl() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [denyReason, setDenyReason] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  // Queries (only run when unlocked)
  const dashboard = useQuery(
    api.fraudControl.getFraudDashboard,
    unlocked ? { adminPin: pin } : "skip"
  );
  const pendingPayouts = useQuery(
    api.fraudControl.getPendingPayouts,
    unlocked ? { adminPin: pin } : "skip"
  );
  const frozenCampaigns = useQuery(
    api.fraudControl.getFrozenCampaigns,
    unlocked ? { adminPin: pin } : "skip"
  );
  const pendingProofs = useQuery(
    api.fraudControl.getPendingOwnershipProofs,
    unlocked ? { adminPin: pin } : "skip"
  );

  // Mutations
  const approvePayout = useMutation(api.fraudControl.approvePayout);
  const denyPayoutMutation = useMutation(api.fraudControl.denyPayout);
  const freezeCampaign = useMutation(api.fraudControl.freezeCampaign);
  const unfreezeCampaign = useMutation(api.fraudControl.unfreezeCampaign);
  const requestProof = useMutation(api.fraudControl.requestOwnershipProof);
  const verifyOwnership = useMutation(api.fraudControl.verifyOwnership);
  const rejectOwnership = useMutation(api.fraudControl.rejectOwnership);

  const handleUnlock = () => {
    if (pin.length >= 4) {
      setUnlocked(true);
      setError("");
    }
  };

  const handleApprove = async (payoutId: string) => {
    setError(""); setSuccess("");
    try {
      await approvePayout({ adminPin: pin, payoutId: payoutId as any });
      setSuccess("Payout approved — ready for completion.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeny = async (payoutId: string) => {
    if (!denyReason) { setError("Reason required to deny payout."); return; }
    setError(""); setSuccess("");
    try {
      await denyPayoutMutation({ adminPin: pin, payoutId: payoutId as any, reason: denyReason });
      setSuccess("Payout denied. Funds returned to holding account.");
      setActionTarget(null);
      setDenyReason("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleFreeze = async (campaignId: string) => {
    if (!freezeReason) { setError("Reason required to freeze campaign."); return; }
    setError(""); setSuccess("");
    try {
      await freezeCampaign({ adminPin: pin, campaignId: campaignId as any, reason: freezeReason });
      setSuccess("Campaign frozen. All associated payouts also frozen.");
      setActionTarget(null);
      setFreezeReason("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUnfreeze = async (campaignId: string) => {
    setError(""); setSuccess("");
    try {
      await unfreezeCampaign({ adminPin: pin, campaignId: campaignId as any });
      setSuccess("Campaign unfrozen. Pending payouts back in review queue.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRequestProof = async (campaignId: string) => {
    setError(""); setSuccess("");
    try {
      await requestProof({ 
        adminPin: pin, 
        campaignId: campaignId as any, 
        message: proofMessage || undefined 
      });
      setSuccess("Ownership proof requested. Campaign owner will be notified.");
      setProofMessage("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleVerifyProof = async (campaignId: string) => {
    setError(""); setSuccess("");
    try {
      await verifyOwnership({ adminPin: pin, campaignId: campaignId as any });
      setSuccess("Ownership verified. Campaign restored to active.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRejectProof = async (campaignId: string, reason: string) => {
    setError(""); setSuccess("");
    try {
      await rejectOwnership({ adminPin: pin, campaignId: campaignId as any, reason });
      setSuccess("Ownership rejected. Campaign frozen.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  // PIN unlock gate
  if (!unlocked) {
    return (
      <div className="space-y-4">
        <div className="card border-ifred/30">
          <h3 className="text-sm font-semibold text-ifred mb-1">Fraud Control</h3>
          <p className="text-xs text-ifmuted mb-4">
            Enter your PIN to access fraud prevention controls. This panel is super admin only.
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className="input-field text-center text-xl tracking-[0.3em] font-bold"
            autoFocus
          />
          <button onClick={handleUnlock} disabled={pin.length < 4} className="btn-primary mt-3">
            Unlock Fraud Control
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dashboard summary */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card text-center">
            <p className="text-2xl font-bold text-ifamber">{dashboard.pendingPayoutsCount}</p>
            <p className="text-[10px] text-ifmuted">Pending Payouts</p>
            <p className="text-[10px] text-ifgreen">${dashboard.pendingPayoutsTotal.toFixed(2)}</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-ifred">{dashboard.frozenCampaignsCount}</p>
            <p className="text-[10px] text-ifmuted">Frozen Campaigns</p>
            <p className="text-[10px] text-ifred">${dashboard.frozenCampaignsTotal.toFixed(2)}</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-ifcyan">{dashboard.ownershipProofPending}</p>
            <p className="text-[10px] text-ifmuted">Proof Requests</p>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-ifred/10 border border-ifred/30 rounded-xl p-3">
          <p className="text-xs text-ifred">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-ifgreen/10 border border-ifgreen/30 rounded-xl p-3">
          <p className="text-xs text-ifgreen">{success}</p>
        </div>
      )}

      {/* Pending Payouts — Approve/Deny */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Payout Approval Queue</h3>
        
        {!pendingPayouts && (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {pendingPayouts && pendingPayouts.length === 0 && (
          <p className="text-xs text-ifmuted text-center py-4">No pending payouts.</p>
        )}

        {pendingPayouts && pendingPayouts.map((p: any) => (
          <div key={p._id} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifborder">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-ifmuted">User: {p.userId}</p>
                <p className="text-sm font-semibold text-iftext">
                  ${p.netAmount.toFixed(2)} <span className="text-[10px] text-ifmuted">net</span>
                </p>
                <p className="text-[10px] text-ifmuted">
                  Gross: ${p.amountRequested.toFixed(2)} | Fees: ${p.feeAmount.toFixed(2)}
                </p>
                <p className="text-[10px] text-ifcyan mt-1">
                  {p.payoutMethod}: {p.payoutDestination}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                p.adminReviewStatus === "approved" ? "bg-ifgreen/20 text-ifgreen" :
                p.adminReviewStatus === "denied" ? "bg-ifred/20 text-ifred" :
                p.adminReviewStatus === "frozen" ? "bg-ifamber/20 text-ifamber" :
                "bg-ifborder text-ifmuted"
              }`}>
                {p.adminReviewStatus?.toUpperCase()}
              </span>
            </div>

            {p.adminReviewStatus === "pending" && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleApprove(p._id)}
                  className="flex-1 py-2 rounded-lg bg-ifgreen/10 text-ifgreen text-xs font-medium border border-ifgreen/30"
                >
                  Approve
                </button>
                <button
                  onClick={() => setActionTarget(actionTarget === `deny-${p._id}` ? null : `deny-${p._id}`)}
                  className="flex-1 py-2 rounded-lg bg-ifred/10 text-ifred text-xs font-medium border border-ifred/30"
                >
                  Deny
                </button>
              </div>
            )}

            {actionTarget === `deny-${p._id}` && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Reason for denial (required)"
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  className="input-field text-xs"
                />
                <button
                  onClick={() => handleDeny(p._id)}
                  disabled={!denyReason}
                  className="w-full py-2 rounded-lg bg-ifred text-white text-xs font-medium"
                >
                  Confirm Denial
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Frozen Campaigns */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Frozen Campaigns</h3>
        
        {!frozenCampaigns && (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {frozenCampaigns && frozenCampaigns.length === 0 && (
          <p className="text-xs text-ifmuted text-center py-4">No frozen campaigns.</p>
        )}

        {frozenCampaigns && frozenCampaigns.map((c: any) => (
          <div key={c._id} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifred/20">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-medium text-iftext">{c.title}</p>
                <p className="text-[10px] text-ifmuted">Raised: ${c.raisedAmount?.toFixed(2) || 0}</p>
                {c.frozenReason && (
                  <p className="text-[10px] text-ifred mt-1">Reason: {c.frozenReason}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full bg-ifred/20 text-ifred text-[10px] font-medium">
                FROZEN
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleUnfreeze(c._id)}
                className="flex-1 py-2 rounded-lg bg-ifgreen/10 text-ifgreen text-xs font-medium border border-ifgreen/30"
              >
                Unfreeze
              </button>
              {c.ownershipProofStatus !== "verified" && (
                <button
                  onClick={() => handleVerifyProof(c._id)}
                  className="px-3 py-2 rounded-lg bg-ifcyan/10 text-ifcyan text-xs font-medium border border-ifcyan/30"
                >
                  Verify Owner
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ownership Proof Requests */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Ownership Proof Requests</h3>
        
        {!pendingProofs && (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {pendingProofs && pendingProofs.length === 0 && (
          <p className="text-xs text-ifmuted text-center py-4">No pending proof requests.</p>
        )}

        {pendingProofs && pendingProofs.map((c: any) => (
          <div key={c._id} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifamber/20">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-medium text-iftext">{c.title}</p>
                <p className="text-[10px] text-ifmuted">Status: {c.ownershipProofStatus}</p>
                {c.ownershipProofNotes && (
                  <p className="text-[10px] text-ifmuted mt-1">{c.ownershipProofNotes}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded-full bg-ifamber/20 text-ifamber text-[10px] font-medium">
                {c.ownershipProofStatus?.toUpperCase()}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleVerifyProof(c._id)}
                className="flex-1 py-2 rounded-lg bg-ifgreen/10 text-ifgreen text-xs font-medium border border-ifgreen/30"
              >
                Verify
              </button>
              <button
                onClick={() => {
                  const reason = prompt("Reason for rejection:");
                  if (reason) handleRejectProof(c._id, reason);
                }}
                className="flex-1 py-2 rounded-lg bg-ifred/10 text-ifred text-xs font-medium border border-ifred/30"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Freeze a campaign by ID */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Freeze a Campaign</h3>
        <input
          type="text"
          placeholder="Campaign ID"
          value={actionTarget === "freeze" ? freezeReason : ""}
          onChange={(e) => { setFreezeReason(e.target.value); setActionTarget("freeze"); }}
          className="input-field text-xs mb-2"
          onFocus={() => setActionTarget("freeze")}
        />
        <p className="text-[10px] text-ifmuted mb-2">
          Enter the campaign ID and reason to freeze. This blocks all payouts and donations.
        </p>
        {actionTarget === "freeze" && freezeReason && (
          <button
            onClick={() => {
              const id = prompt("Enter campaign ID to freeze:");
              if (id) handleFreeze(id);
            }}
            className="w-full py-2 rounded-lg bg-ifred text-white text-xs font-medium"
          >
            Freeze Campaign
          </button>
        )}
      </div>

      {/* Security notice */}
      <div className="text-center py-2">
        <p className="text-[10px] text-ifmuted">
          All actions are logged with timestamp and admin identity. Irreversible actions require confirmation.
        </p>
      </div>
    </div>
  );
}
