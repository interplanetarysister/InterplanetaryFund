import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Globe2 } from "lucide-react";
import { Link } from "react-router-dom";
import { platformName } from "@/components/connections/platformCatalog";

// Universal campaign synchronization — the combined fundraising picture across
// Interplanetary Fund and every connected external platform. Owner-only view.
export default function CrossPlatformTotals({ campaign }) {
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    base44.functions
      .invoke("listConnections", {})
      .then(({ data }) => setConnections(
        (data?.connections || []).filter(
          (connection) => connection.campaign_id === campaign.id && connection.kind === "crowdfunding"
        )
      ))
      .catch(() => {});
  }, [campaign.id]);

  if (!connections.length) return null;

  const ifRaised = campaign.raised_amount || 0;
  const usdConnections = connections.filter((c) => c.external_currency === "USD");
  const excludedCurrencies = [...new Set(
    connections
      .map((c) => c.external_currency || "UNSPECIFIED")
      .filter((currency) => currency !== "USD")
  )];
  const externalRaised = usdConnections.reduce((s, c) => s + (c.external_total || 0), 0);
  const totalDonors = (campaign.donor_count || 0) + connections.reduce((s, c) => s + (c.external_donor_count || 0), 0);
  const formatExternal = (connection) => `${connection.external_currency || "UNSPECIFIED"} ${(connection.external_total || 0).toLocaleString()}`;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-lg text-stone-900 mb-3">
        <Globe2 className="w-4 h-4 text-primary" /> All platforms combined
      </h3>
      <p className="font-display text-3xl text-stone-900">USD {(ifRaised + externalRaised).toLocaleString()}</p>
      <p className="text-xs text-stone-500">Reported USD total · {totalDonors} reported donors across every destination</p>
      <p className="text-xs text-amber-700 mb-3">External figures may be added by you, remain informational, and are not Interplanetary Fund-withdrawable until independently verified and transferred.</p>
      {excludedCurrencies.length > 0 && <p className="text-xs text-stone-500 mb-3">Excluded from the USD total to avoid false conversion: {excludedCurrencies.join(", ")}.</p>}
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between text-stone-700">
          <span>Interplanetary Fund</span>
          <span className="font-semibold text-primary">USD {ifRaised.toLocaleString()}</span>
        </li>
        {connections.map((c) => (
          <li key={c.id} className="flex justify-between text-stone-700">
            <span>{platformName(c.platform)} <span className="text-xs text-stone-400">({c.external_data_source === "provider_verified" ? "checked" : "added by you"})</span></span>
            <span className="font-semibold">{formatExternal(c)}</span>
          </li>
        ))}
      </ul>
      <Link to="/connections" className="block text-xs text-primary hover:text-primary/80 mt-3">Manage connections →</Link>
    </div>
  );
}