/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Platforms() {
  const [userId, setUserId] = useState("user1");
  const [platformName, setPlatformName] = useState("GoFundMe");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [connectionType, setConnectionType] = useState("manual");

  const externalBalances = useQuery(api.campaigns.getAllExternalBalances, {});
  const userPlatforms = useQuery(api.campaigns.getExternalPlatforms, { userId });
  const connectPlatform = useMutation(api.campaigns.connectExternalPlatform);

  const handleConnect = async () => {
    try {
      await connectPlatform({
        userId,
        platformName,
        campaignUrl,
        campaignTitle,
        connectionType,
      });
      setCampaignUrl("");
      setCampaignTitle("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">External Platforms</h2>
        <p className="page-subtitle">Connect GoFundMe, Kickstarter, Facebook & more</p>
      </div>

      {/* Aggregate External Balances */}
      {externalBalances && externalBalances.total > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-iftext mb-3">Connected Platforms</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-ifdark rounded-xl p-3">
              <p className="text-xs text-ifmuted">External Raised</p>
              <p className="text-xl font-bold text-ifcyan mt-1">
                ${externalBalances.grandTotalRaised.toLocaleString()}
              </p>
            </div>
            <div className="bg-ifdark rounded-xl p-3">
              <p className="text-xs text-ifmuted">External Donors</p>
              <p className="text-xl font-bold text-ifgreen mt-1">
                {externalBalances.grandTotalDonors.toLocaleString()}
              </p>
            </div>
          </div>

          {/* By Platform */}
          <div className="mt-3 pt-3 border-t border-ifborder space-y-2">
            {Object.entries(externalBalances.byPlatform).map(([platform, data]: [string, any]) => (
              <div key={platform} className="bg-ifdark rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-iftext">{platform}</span>
                  <span className="badge badge-cyan">{data.count} campaigns</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-ifmuted">Raised: ${data.totalRaised.toLocaleString()}</span>
                  <span className="text-ifmuted">{data.totalDonors} donors</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect New Platform */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Connect External Campaign</h3>
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="input mb-2"
        />
        <select
          value={platformName}
          onChange={(e) => setPlatformName(e.target.value)}
          className="input mb-2"
        >
          <option value="GoFundMe">GoFundMe</option>
          <option value="Kickstarter">Kickstarter</option>
          <option value="Facebook">Facebook Fundraisers</option>
          <option value="Instagram">Instagram</option>
          <option value="Custom">Custom / Other</option>
        </select>
        <input
          type="text"
          placeholder="Campaign URL (e.g., https://gofundme.com/...)"
          value={campaignUrl}
          onChange={(e) => setCampaignUrl(e.target.value)}
          className="input mb-2"
        />
        <input
          type="text"
          placeholder="Campaign Title"
          value={campaignTitle}
          onChange={(e) => setCampaignTitle(e.target.value)}
          className="input mb-2"
        />
        <select
          value={connectionType}
          onChange={(e) => setConnectionType(e.target.value)}
          className="input mb-3"
        >
          <option value="manual">Manual (enter data yourself)</option>
          <option value="oauth">OAuth (connect account)</option>
          <option value="api_key">API Key (platform API)</option>
        </select>
        <button
          onClick={handleConnect}
          disabled={!campaignUrl || !campaignTitle}
          className="btn-primary"
        >
          Connect Platform
        </button>
      </div>

      {/* User's Connected Platforms */}
      {userPlatforms && userPlatforms.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-iftext mb-3">Your Connections</h3>
          {userPlatforms.map((p: any) => (
            <div key={p._id} className="bg-ifdark rounded-xl p-3 mb-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-iftext">{p.campaignTitle}</p>
                  <p className="text-[10px] text-ifmuted mt-0.5">{p.platformName} · {p.connectionType}</p>
                </div>
                <span className={`badge ${
                  p.syncStatus === "success" ? "badge-green" :
                  p.syncStatus === "error" ? "badge-red" :
                  "badge-amber"
                }`}>
                  {p.syncStatus}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-ifmuted">Raised: ${p.raisedAmount.toLocaleString()}</span>
                <span className="text-ifmuted">{p.donorCount} donors</span>
              </div>
              <p className="text-[10px] text-ifmuted mt-1">
                Last sync: {p.lastSynced ? new Date(p.lastSynced).toLocaleString() : "Never"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Info Note */}
      <div className="card bg-ifdark border-ifborder">
        <p className="text-xs text-ifmuted leading-relaxed">
          <span className="text-ifcyan font-medium">Phase 1:</span> Manual entry — you enter campaign data from external platforms.
          <br /><br />
          <span className="text-ifcyan font-medium">Phase 2:</span> API sync — automatic polling for GoFundMe Charity API and other supported platforms.
          <br /><br />
          <span className="text-ifcyan font-medium">Phase 3:</span> Webhooks — real-time updates when donations arrive on external platforms.
        </p>
      </div>
    </div>
  );
}
