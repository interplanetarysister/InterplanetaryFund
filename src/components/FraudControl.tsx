/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Fraud Control Panel — active super-admin session only.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function FraudControl({ sessionToken }: { sessionToken: string }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [denyReason, setDenyReason] = useState("");
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [freezeReason, setFreezeReason] = useState("");

  const sessionArgs = { sessionToken: sessionToken };
  const dashboard = useQuery(api.fraudControl.getFraudDashboard, sessionArgs);
  const pendingPayouts = useQuery(api.fraudControl.getPendingPayouts, sessionArgs);
  const frozenCampaigns = useQuery(api.fraudControl.getFrozenCampaigns, sessionArgs);
  const pendingProofs = useQuery(api.fraudControl.getPendingOwnershipProofs, sessionArgs);

  const approvePayout = useMutation(api.fraudControl.approvePayout);
  const denyPayoutMutation = useMutation(api.fraudControl.denyPayout);
  const freezeCampaign = useMutation(api.fraudControl.freezeCampaign);
  const unfreezeCampaign = useMutation(api.fraudControl.unfreezeCampaign);
  const requestProof = useMutation(api.fraudControl.requestOwnershipProof);
  const verifyOwnership = useMutation(api.fraudControl.verifyOwnership);
  const rejectOwnership = useMutation(api.fraudControl.rejectOwnership);

  const fail = (e: any) => setError(e?.message || "Fraud-control action failed.");
  const resetMessage = () => { setError(""); setSuccess(""); };

  const handleApprove = async (payoutId: string) => {
    resetMessage();
    try { await approvePayout({ sessionToken: sessionToken, payoutId: payoutId as any }); setSuccess("Payout approved for completion."); }
    catch (e) { fail(e); }
  };

  const handleDeny = async (payoutId: string) => {
    if (!denyReason.trim()) { setError("Reason required to deny payout."); return; }
    resetMessage();
    try {
      await denyPayoutMutation({ sessionToken: sessionToken, payoutId: payoutId as any, reason: denyReason.trim() });
      setSuccess("Payout denied. Funds returned to the holding account.");
      setActionTarget(null); setDenyReason("");
    } catch (e) { fail(e); }
  };

  const handleFreeze = async () => {
    if (!campaignId.trim() || !freezeReason.trim()) { setError("Campaign ID and freeze reason are required."); return; }
    resetMessage();
    try {
      await freezeCampaign({ sessionToken: sessionToken, campaignId: campaignId.trim() as any, reason: freezeReason.trim() });
      setSuccess("Campaign frozen. Unrelated payout requests were left unchanged.");
      setCampaignId(""); setFreezeReason("");
    } catch (e) { fail(e); }
  };

  const handleUnfreeze = async (id: string) => {
    resetMessage();
    try { await unfreezeCampaign({ sessionToken: sessionToken, campaignId: id as any }); setSuccess("Campaign unfrozen."); }
    catch (e) { fail(e); }
  };

  const handleVerifyProof = async (id: string) => {
    resetMessage();
    try { await verifyOwnership({ sessionToken: sessionToken, campaignId: id as any }); setSuccess("Ownership verified."); }
    catch (e) { fail(e); }
  };

  const handleRejectProof = async (id: string, reason: string) => {
    resetMessage();
    try { await rejectOwnership({ sessionToken: sessionToken, campaignId: id as any, reason }); setSuccess("Ownership rejected. Campaign frozen."); }
    catch (e) { fail(e); }
  };

  const handleRequestProof = async (id: string) => {
    resetMessage();
    try { await requestProof({ sessionToken: sessionToken, campaignId: id as any }); setSuccess("Ownership proof requested."); }
    catch (e) { fail(e); }
  };

  return (
    <div className="space-y-4">
      <div className="card border-ifred/30">
        <h3 className="text-sm font-semibold text-ifred">Fraud Control</h3>
        <p className="text-[10px] text-ifmuted mt-1">Server-verified super-admin session required for every read and mutation.</p>
      </div>

      {dashboard && <div className="grid grid-cols-3 gap-2">
        <div className="card text-center"><p className="text-2xl font-bold text-ifamber">{dashboard.pendingPayoutsCount}</p><p className="text-[10px] text-ifmuted">Pending Payouts</p><p className="text-[10px] text-ifgreen">${dashboard.pendingPayoutsTotal.toFixed(2)}</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-ifred">{dashboard.frozenCampaignsCount}</p><p className="text-[10px] text-ifmuted">Frozen Campaigns</p><p className="text-[10px] text-ifred">${dashboard.frozenCampaignsTotal.toFixed(2)}</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-ifcyan">{dashboard.ownershipProofPending}</p><p className="text-[10px] text-ifmuted">Proof Requests</p></div>
      </div>}

      {error && <div className="bg-ifred/10 border border-ifred/30 rounded-xl p-3"><p className="text-xs text-ifred">{error}</p></div>}
      {success && <div className="bg-ifgreen/10 border border-ifgreen/30 rounded-xl p-3"><p className="text-xs text-ifgreen">{success}</p></div>}

      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Payout Approval Queue</h3>
        {!pendingPayouts && <p className="text-xs text-ifmuted">Loading…</p>}
        {pendingPayouts?.length === 0 && <p className="text-xs text-ifmuted text-center py-4">No pending payouts.</p>}
        {pendingPayouts?.map((p: any) => <div key={p._id} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifborder">
          <div className="flex justify-between items-start mb-2">
            <div><p className="text-xs text-ifmuted">User: {p.userId}</p><p className="text-sm font-semibold text-iftext">${p.netAmount.toFixed(2)} <span className="text-[10px] text-ifmuted">net</span></p><p className="text-[10px] text-ifmuted">Gross: ${p.amountRequested.toFixed(2)} | Fees: ${p.feeAmount.toFixed(2)}</p><p className="text-[10px] text-ifcyan mt-1">{p.payoutMethod}: {p.payoutDestination}</p></div>
            <span className="text-[10px] text-ifmuted">{p.adminReviewStatus?.toUpperCase()}</span>
          </div>
          {p.adminReviewStatus === "pending" && <div className="flex gap-2"><button onClick={() => handleApprove(p._id)} className="flex-1 py-2 rounded-lg bg-ifgreen/10 text-ifgreen text-xs border border-ifgreen/30">Approve</button><button onClick={() => setActionTarget(`deny-${p._id}`)} className="flex-1 py-2 rounded-lg bg-ifred/10 text-ifred text-xs border border-ifred/30">Deny</button></div>}
          {actionTarget === `deny-${p._id}` && <div className="mt-2 space-y-2"><input value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Reason for denial" className="input-field text-xs"/><button onClick={() => handleDeny(p._id)} className="w-full py-2 rounded-lg bg-ifred text-white text-xs">Confirm Denial</button></div>}
        </div>)}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Frozen Campaigns</h3>
        {frozenCampaigns?.length === 0 && <p className="text-xs text-ifmuted text-center py-4">No frozen campaigns.</p>}
        {frozenCampaigns?.map((c: any) => <div key={c._id} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifred/20">
          <p className="text-sm font-medium text-iftext">{c.title}</p><p className="text-[10px] text-ifred">{c.frozenReason}</p>
          <div className="flex gap-2 mt-2"><button onClick={() => handleUnfreeze(c._id)} className="flex-1 py-2 rounded-lg bg-ifgreen/10 text-ifgreen text-xs border border-ifgreen/30">Unfreeze</button><button onClick={() => handleRequestProof(c._id)} className="px-3 py-2 rounded-lg bg-ifcyan/10 text-ifcyan text-xs border border-ifcyan/30">Request Proof</button></div>
        </div>)}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Ownership Proof Requests</h3>
        {pendingProofs?.length === 0 && <p className="text-xs text-ifmuted text-center py-4">No pending proof requests.</p>}
        {pendingProofs?.map((c: any) => <div key={c._id} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifamber/20">
          <p className="text-sm font-medium text-iftext">{c.title}</p><p className="text-[10px] text-ifmuted">{c.ownershipProofStatus}</p>
          <div className="flex gap-2 mt-2"><button onClick={() => handleVerifyProof(c._id)} className="flex-1 py-2 rounded-lg bg-ifgreen/10 text-ifgreen text-xs border border-ifgreen/30">Verify</button><button onClick={() => { const reason = prompt("Reason for rejection:"); if (reason) handleRejectProof(c._id, reason); }} className="flex-1 py-2 rounded-lg bg-ifred/10 text-ifred text-xs border border-ifred/30">Reject</button></div>
        </div>)}
      </div>

      <div className="card space-y-2">
        <h3 className="text-sm font-semibold text-iftext">Freeze a Campaign</h3>
        <input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="Campaign document ID" className="input-field text-xs"/>
        <input value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} placeholder="Reason for freeze" className="input-field text-xs"/>
        <button onClick={handleFreeze} disabled={!campaignId.trim() || !freezeReason.trim()} className="w-full py-2 rounded-lg bg-ifred text-white text-xs font-medium">Freeze Campaign</button>
      </div>
    </div>
  );
}
