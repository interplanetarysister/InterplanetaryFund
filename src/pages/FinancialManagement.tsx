/*
 * Interplanetary Fund — Connected Accounts & Financial Management
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Full financial management interface:
 *  - Connect external payment accounts
 *  - Authorize accounts per campaign
 *  - Consolidate funds from external providers
 *  - View campaign financial ledger
 *  - Enable/disable AI campaign management
 *  - View audit log
 *  - Secure withdrawal flow with fee breakdown
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function FinancialManagement({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<"accounts" | "consolidate" | "ledger" | "automation" | "audit" | "withdraw">("accounts");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Queries
  const campaigns = useQuery(api.userCampaigns.getMyCampaigns, { userId });
  const connectedAccounts = useQuery(api.connectedAccounts.getConnectedAccounts, { userId });
  const supportedProviders = useQuery(api.paymentProviders.getSupportedProviders);

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage connected accounts, consolidate funds, view your campaign ledger, and control AI automation.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {[
          { key: "accounts", label: "Connected Accounts" },
          { key: "consolidate", label: "Consolidate Funds" },
          { key: "ledger", label: "Financial Ledger" },
          { key: "automation", label: "AI Automation" },
          { key: "withdraw", label: "Withdrawal" },
          { key: "audit", label: "Audit Log" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Campaign Selector */}
      {campaigns && campaigns.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Campaign</label>
          <select
            value={selectedCampaignId || ""}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          >
            <option value="">— Select a campaign —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "accounts" && <ConnectedAccountsTab userId={userId} campaignId={selectedCampaignId} accounts={connectedAccounts} providers={supportedProviders} />}
      {activeTab === "consolidate" && <ConsolidateFundsTab userId={userId} campaignId={selectedCampaignId} />}
      {activeTab === "ledger" && <LedgerTab campaignId={selectedCampaignId} />}
      {activeTab === "automation" && <AutomationTab userId={userId} campaignId={selectedCampaignId} />}
      {activeTab === "withdraw" && <WithdrawTab userId={userId} campaignId={selectedCampaignId} />}
      {activeTab === "audit" && <AuditTab campaignId={selectedCampaignId} />}
    </div>
  );
}

// =====================================================
// CONNECTED ACCOUNTS TAB
// =====================================================
function ConnectedAccountsTab({ userId, campaignId, accounts, providers }: any) {
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [accountId, setAccountId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const connectAccount = useMutation(api.connectedAccounts.connectAccount);
  const revokeAccount = useMutation(api.connectedAccounts.revokeAccount);
  const authorizations = useQuery(
    api.connectedAccounts.getCampaignAuthorizations,
    campaignId ? { campaignId } : "skip" as any
  );
  const authorizeAccount = useMutation(api.connectedAccounts.authorizeAccount);

  const handleConnect = async () => {
    if (!selectedProvider || !accountId) return;
    try {
      await connectAccount({
        userId,
        provider: selectedProvider,
        providerAccountId: accountId,
        providerDisplayName: displayName || accountId,
        connectionMethod: "manual",
        scopes: ["manual_entry"],
      });
      setShowConnectForm(false);
      setSelectedProvider("");
      setAccountId("");
      setDisplayName("");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAuthorize = async (connectedAccountId: string) => {
    if (!campaignId) { alert("Select a campaign first"); return; }
    try {
      await authorizeAccount({
        userId,
        campaignId,
        connectedAccountId,
        permissions: ["read_transactions", "sync_funds"],
        authorizationScope: "sync_and_reconcile",
      });
      alert("Account authorized for this campaign");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRevoke = async (accountId: string) => {
    if (!confirm("Revoke this connected account? This will disable all authorizations and automations using it.")) return;
    try {
      await revokeAccount({ userId, connectedAccountId: accountId });
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connected Payment Accounts</h2>
        <button
          onClick={() => setShowConnectForm(!showConnectForm)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          {showConnectForm ? "Cancel" : "+ Connect Account"}
        </button>
      </div>

      {showConnectForm && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="">— Select provider —</option>
              {providers?.map((p: any) => (
                <option key={p.provider} value={p.provider}>
                  {p.displayName} {p.supportsManualConnection ? "(Manual)" : p.supportsOAuth ? "(OAuth)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Account ID / Email</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. your@email.com or account ID"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Display Name (optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. My PayPal Account"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={handleConnect}
            disabled={!selectedProvider || !accountId}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Connect Account
          </button>
        </div>
      )}

      {/* Connected Accounts List */}
      <div className="space-y-3">
        {accounts?.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No connected accounts yet. Connect a payment provider to get started.
          </p>
        )}
        {accounts?.map((account: any) => (
          <div key={account.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{account.providerDisplayName}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    account.connectionStatus === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}>
                    {account.connectionStatus}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {account.provider} · Connected {new Date(account.connectedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                {campaignId && account.connectionStatus === "active" && (
                  <button
                    onClick={() => handleAuthorize(account.id)}
                    className="px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950"
                  >
                    Authorize for Campaign
                  </button>
                )}
                <button
                  onClick={() => handleRevoke(account.id)}
                  className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaign Authorizations */}
      {campaignId && authorizations && authorizations.length > 0 && (
        <div className="mt-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">Authorizations for This Campaign</h3>
          <div className="space-y-2">
            {authorizations.map((auth: any) => (
              <div key={auth.id} className="flex justify-between items-center border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{auth.provider}</span>
                  <span className="ml-2 text-gray-500">{auth.authorizationScope}</span>
                </div>
                <span className="text-xs text-gray-400">Granted {new Date(auth.grantedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// CONSOLIDATE FUNDS TAB
// =====================================================
function ConsolidateFundsTab({ userId, campaignId }: any) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const lastRun = useQuery(
    api.fundConsolidation.getLastConsolidation,
    campaignId ? { campaignId } : "skip" as any
  );
  const consolidateFunds = useMutation(api.fundConsolidation.consolidateFunds);

  const handleConsolidate = async () => {
    if (!campaignId) { alert("Select a campaign first"); return; }
    if (!confirm("Consolidate funds from all authorized accounts for this campaign?")) return;
    setLoading(true);
    try {
      const res = await consolidateFunds({ userId, campaignId });
      setResult(res);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Consolidate Funds</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Consolidate and reconcile financial activity from your connected funding sources into the campaign ledger.
        This detects eligible transactions, verifies their source, matches them to your campaign, and updates your ledger.
      </p>

      {!campaignId && (
        <p className="text-sm text-amber-600 dark:text-amber-400">Select a campaign to consolidate funds.</p>
      )}

      {/* Last Run Summary */}
      {lastRun && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
          <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Last Consolidation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Status</p>
              <p className="font-medium text-gray-900 dark:text-white">{lastRun.status}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">New Transactions</p>
              <p className="font-medium text-gray-900 dark:text-white">{lastRun.transactionsImported}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Duplicates Skipped</p>
              <p className="font-medium text-gray-900 dark:text-white">{lastRun.transactionsDuplicate}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Imported Amount</p>
              <p className="font-medium text-green-600 dark:text-green-400">${lastRun.totalImportedAmount?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Previously Reconciled</p>
              <p className="font-medium text-gray-900 dark:text-white">${lastRun.previouslyReconciledAmount?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Pending</p>
              <p className="font-medium text-amber-600 dark:text-amber-400">${lastRun.pendingAmount?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Failed</p>
              <p className="font-medium text-red-600 dark:text-red-400">${lastRun.failedAmount?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Run Date</p>
              <p className="font-medium text-gray-900 dark:text-white">{lastRun.completedAt ? new Date(lastRun.completedAt).toLocaleString() : "—"}</p>
            </div>
          </div>

          {lastRun.accountsRequiringReauth && lastRun.accountsRequiringReauth.length > 0 && (
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-xs text-amber-700 dark:text-amber-300">
              ⚠ {lastRun.accountsRequiringReauth.length} account(s) require reauthorization
            </div>
          )}

          {lastRun.discrepancies && lastRun.discrepancies.length > 0 && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-700 dark:text-red-300">
              {lastRun.discrepancies.map((d: any, i: number) => (
                <div key={i}>⚠ {d.description}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Consolidate Button */}
      <button
        onClick={handleConsolidate}
        disabled={!campaignId || loading}
        className="px-6 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Consolidating..." : "CONSOLIDATE FUNDS"}
      </button>

      {/* Latest Result */}
      {result && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-green-50 dark:bg-green-950">
          <h3 className="text-sm font-semibold mb-2 text-green-800 dark:text-green-300">Consolidation Complete</h3>
          <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <p>Newly discovered: {result.newlyDiscovered} transactions</p>
            <p>Newly imported: {result.newlyImported} transactions (${result.totalImportedAmount?.toFixed(2)})</p>
            <p>Duplicates skipped: {result.duplicates}</p>
            <p>Previously reconciled: ${result.previouslyReconciled?.toFixed(2)}</p>
            <p>Pending: ${result.pending?.toFixed(2)}</p>
            <p>Failed: ${result.failed?.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// FINANCIAL LEDGER TAB
// =====================================================
function LedgerTab({ campaignId }: any) {
  const balance = useQuery(
    api.campaignLedger.getCampaignBalance,
    campaignId ? { campaignId } : "skip" as any
  );
  const ledgerEntries = useQuery(
    api.campaignLedger.getCampaignLedger,
    campaignId ? { campaignId, limit: 50 } : "skip" as any
  );

  if (!campaignId) {
    return <p className="text-sm text-gray-500">Select a campaign to view its financial ledger.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Campaign Financial Ledger</h2>

      {/* Balance Summary */}
      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-green-50 dark:bg-green-950">
            <p className="text-xs text-gray-500 dark:text-gray-400">Gross Donations</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">${balance.grossDonations.toFixed(2)}</p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-blue-50 dark:bg-blue-950">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Fees</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">${balance.totalFees.toFixed(2)}</p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-purple-50 dark:bg-purple-950">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Payouts</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">${balance.totalPayouts.toFixed(2)}</p>
          </div>
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-950">
            <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">${balance.availableFunds.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Fee Breakdown */}
      {balance && balance.totalFees > 0 && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Platform Fee (IF)</span><span className="text-gray-900 dark:text-white">${balance.totalPlatformFees.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Processing Fee</span><span className="text-gray-900 dark:text-white">${balance.totalProcessingFees.toFixed(2)}</span></div>
          {balance.totalRefunds > 0 && <div className="flex justify-between"><span className="text-gray-500">Refunds</span><span className="text-red-600">-${balance.totalRefunds.toFixed(2)}</span></div>}
          {balance.totalChargebacks > 0 && <div className="flex justify-between"><span className="text-gray-500">Chargebacks</span><span className="text-red-600">-${balance.totalChargebacks.toFixed(2)}</span></div>}
          {balance.pendingFunds > 0 && <div className="flex justify-between"><span className="text-gray-500">Pending</span><span className="text-amber-600">${balance.pendingFunds.toFixed(2)}</span></div>}
        </div>
      )}

      {/* Ledger Entries */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Description</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Gross</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Fees</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Net</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {ledgerEntries?.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No ledger entries yet</td></tr>
            )}
            {ledgerEntries?.map((entry: any) => (
              <tr key={entry.id}>
                <td className="px-3 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    entry.entryType === "donation" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                    entry.entryType === "payout" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                    entry.entryType === "consolidation" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" :
                    entry.entryType === "refund" || entry.entryType === "chargeback" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}>{entry.entryType}</span>
                </td>
                <td className="px-3 py-2 text-gray-900 dark:text-white">{entry.description}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-white">${(entry.grossAmount ?? entry.amount).toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-gray-500">{entry.platformFee != null ? `$${(entry.platformFee + (entry.processingFee ?? 0)).toFixed(2)}` : "—"}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">{entry.netAmount != null ? `$${entry.netAmount.toFixed(2)}` : "—"}</td>
                <td className="px-3 py-2 text-gray-500">{entry.status}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(entry.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================
// AUTOMATION TAB
// =====================================================
function AutomationTab({ userId, campaignId }: any) {
  const [showAgreement, setShowAgreement] = useState(false);
  const agreementText = useQuery(api.automationConsent.getAgreementText);
  const automationStatus = useQuery(
    api.automationConsent.getAutomationStatus,
    campaignId ? { campaignId } : "skip" as any
  );
  const acceptConsent = useMutation(api.automationConsent.acceptConsent);
  const revokeConsent = useMutation(api.automationConsent.revokeConsent);

  const handleAccept = async () => {
    if (!campaignId) { alert("Select a campaign first"); return; }
    try {
      await acceptConsent({
        userId,
        campaignId,
        permissions: ["read_transactions", "sync_funds", "reconcile"],
        connectedProviders: [],
        agreementVersion: agreementText?.version || "1.0.0",
      });
      setShowAgreement(false);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("Disable AI campaign management? Your financial records and audit logs will be preserved.")) return;
    try {
      await revokeConsent({ userId, campaignId });
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!campaignId) {
    return <p className="text-sm text-gray-500">Select a campaign to manage AI automation.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Automated AI Campaign Management</h2>

      {automationStatus?.enabled ? (
        <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-950">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="font-medium text-green-800 dark:text-green-300">Automation Active</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The AI is monitoring authorized integrations and reconciling transactions for this campaign.
          </p>
          <div className="mt-3 text-sm space-y-1">
            <p><span className="text-gray-500">Agreement Version:</span> {(automationStatus as any)?.agreementVersion}</p>
            <p><span className="text-gray-500">Accepted:</span> {new Date((automationStatus as any)?.acceptedAt || Date.now()).toLocaleString()}</p>
            <p><span className="text-gray-500">Permissions:</span> {(automationStatus as any)?.permissions?.join(", ")}</p>
            <p><span className="text-gray-500">Providers:</span> {(automationStatus as any)?.connectedProviders?.join(", ") || "None connected"}</p>
          </div>
          <button
            onClick={handleRevoke}
            className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
          >
            TURN OFF AUTOMATED AI CAMPAIGN MANAGEMENT
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Enable the AI to monitor your authorized payment integrations, reconcile transactions, identify
            discrepancies, and update your campaign financial information — all within your explicit authorization.
          </p>

          {showAgreement && agreementText ? (
            <div className="space-y-3">
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {agreementText.text}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                >
                  I Accept — Enable Automation
                </button>
                <button
                  onClick={() => setShowAgreement(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAgreement(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              ENABLE AUTOMATED AI CAMPAIGN MANAGEMENT
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// WITHDRAWAL TAB
// =====================================================
function WithdrawTab({ userId, campaignId }: any) {
  const [method, setMethod] = useState("paypal");
  const [destination, setDestination] = useState("");
  const [result, setResult] = useState<any>(null);

  const balance = useQuery(
    api.secureWithdraw.getBalance,
    campaignId ? { campaignId } : "skip" as any
  );
  const withdraw = useMutation(api.secureWithdraw.withdraw);

  const handleWithdraw = async () => {
    if (!campaignId) { alert("Select a campaign first"); return; }
    if (!destination) { alert("Enter a payout destination"); return; }
    if (!confirm(`Withdraw $${(balance?.availableBalance || 0).toFixed(2)} to receive $${(balance?.netAmount || 0).toFixed(2)} via ${method}?`)) return;

    try {
      const res = await withdraw({
        userId,
        campaignId,
        payoutMethod: method,
        payoutDestination: destination,
        idempotencyKey: `withdraw_${campaignId}_${Date.now()}`,
      });
      setResult(res);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!campaignId) {
    return <p className="text-sm text-gray-500">Select a campaign to withdraw funds.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Withdraw Funds</h2>

      {balance?.found && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
          {/* Fee Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Gross Amount</span>
              <span className="font-medium text-gray-900 dark:text-white">${balance.grossAmount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Interplanetary Fund Fee (5%)</span>
              <span className="text-red-600 dark:text-red-400">-${balance.platformFee?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Processing Fee (2.9% + $0.30)</span>
              <span className="text-red-600 dark:text-red-400">-${balance.processingFee?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-2 font-semibold">
              <span className="text-gray-900 dark:text-white">You Receive</span>
              <span className="text-green-600 dark:text-green-400">${balance?.netAmount || 0?.toFixed(2)}</span>
            </div>
          </div>

          {/* Withdrawal Form */}
          <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Payout Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="paypal">PayPal</option>
                <option value="cashapp">Cash App</option>
                <option value="bank_transfer">Bank Transfer (ACH)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={method === "paypal" ? "your@email.com" : method === "cashapp" ? "$cashtag" : "Bank account info"}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <button
              onClick={handleWithdraw}
              disabled={(balance?.availableBalance || 0) <= 0}
              className="w-full px-4 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {(balance?.availableBalance || 0) > 0
                ? `Withdraw $${(balance?.availableBalance || 0).toFixed(2)} → Receive $${(balance?.netAmount || 0).toFixed(2)}`
                : "No Funds Available"
              }
            </button>
          </div>

          {result && (
            <div className="border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50 dark:bg-green-950 text-sm">
              <p className="font-medium text-green-800 dark:text-green-300">Withdrawal Requested</p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{result.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// AUDIT LOG TAB
// =====================================================
function AuditTab({ campaignId }: any) {
  const auditLog = useQuery(
    api.financialAudit.getCampaignAuditLog,
    campaignId ? { campaignId, limit: 50 } : "skip" as any
  );

  if (!campaignId) {
    return <p className="text-sm text-gray-500">Select a campaign to view its audit log.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Audit Log</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Immutable record of all financial actions for this campaign. Every user and AI action is logged here.
      </p>

      <div className="space-y-2">
        {auditLog?.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No audit entries yet.</p>
        )}
        {auditLog?.map((entry: any) => (
          <div key={entry.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mr-2 ${
                  entry.result === "success" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                  "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                }`}>{entry.action}</span>
                <span className="text-gray-500 text-xs">{entry.initiatedBy}</span>
              </div>
              <span className="text-gray-400 text-xs">{new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            {entry.metadata && (
              <p className="mt-1 text-gray-600 dark:text-gray-400 text-xs">
                {(() => { try { return JSON.parse(entry.metadata)?.description || entry.metadata; } catch { return entry.metadata; } })()}
              </p>
            )}
            {entry.transactionAmount != null && (
              <p className="mt-1 text-gray-900 dark:text-white font-medium">${entry.transactionAmount.toFixed(2)}</p>
            )}
            {entry.errorMessage && (
              <p className="mt-1 text-red-500 text-xs">Error: {entry.errorMessage}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
