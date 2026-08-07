/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState } from "react";

interface Migration {
  campaignId: string;
  campaignTitle: string;
  sourcePlatform: string;
  grossAmount: number;
}

export function FundMigrationDashboard() {
  const [migrations, setMigrations] = useState<Migration[]>([
    { campaignId: "", campaignTitle: "", sourcePlatform: "", grossAmount: 0 },
  ]);
  const [results, setResults] = useState(null);

  const addMigration = () => {
    setMigrations([...migrations, { campaignId: "", campaignTitle: "", sourcePlatform: "", grossAmount: 0 }]);
  };

  const updateMigration = (index: number, field: keyof Migration, value: string | number) => {
    const updated = [...migrations];
    updated[index] = { ...updated[index], [field]: value };
    setMigrations(updated);
  };

  const removeMigration = (index: number) => {
    setMigrations(migrations.filter((_, i) => i !== index));
  };

  // Calculate totals preview
  const totalGross = migrations.reduce((sum, m) => sum + (m.grossAmount || 0), 0);
  const totalPlatformFee = totalGross * 0.05;
  const totalProcessingFee = totalGross * 0.029 + (migrations.length * 0.30);
  const totalNet = totalGross - totalPlatformFee - totalProcessingFee;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Fund Migration</h1>
        
        <p className="text-sm text-gray-600 mb-4">
          Withdraw funds from external platforms and process them through IF.
          The platform takes 5% + 2.9% + $0.30 per withdrawal.
        </p>

        {migrations.map((m, i) => (
          <div key={i} className="bg-white rounded-xl p-4 mb-3 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Migration #{i + 1}</span>
              {migrations.length > 1 && (
                <button
                  onClick={() => removeMigration(i)}
                  className="text-red-500 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            
            <input
              placeholder="Campaign title"
              value={m.campaignTitle}
              onChange={(e) => updateMigration(i, "campaignTitle", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            
            <select
              value={m.sourcePlatform}
              onChange={(e) => updateMigration(i, "sourcePlatform", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="">Select platform...</option>
              <option value="BuyMeACoffee">Buy Me a Coffee</option>
              <option value="Patreon">Patreon</option>
              <option value="Ko-fi">Ko-fi</option>
              <option value="GoFundMe">GoFundMe</option>
              <option value="Spotfund">Spotfund</option>
              <option value="Kickstarter">Kickstarter</option>
              <option value="Indiegogo">Indiegogo</option>
              <option value="GiveSendGo">GiveSendGo</option>
              <option value="FundRazr">FundRazr</option>
              <option value="Facebook">Facebook</option>
            </select>
            
            <div className="flex items-center gap-2">
              <span className="font-semibold">$</span>
              <input
                type="number"
                placeholder="Amount withdrawn"
                value={m.grossAmount || ""}
                onChange={(e) => updateMigration(i, "grossAmount", parseFloat(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        ))}

        <button
          onClick={addMigration}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm mb-4"
        >
          + Add another withdrawal
        </button>

        {/* Summary */}
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total withdrawn</span>
            <span className="font-semibold">${totalGross.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Platform fee (5%)</span>
            <span className="text-red-500">-${totalPlatformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Processing (2.9% + $0.30)</span>
            <span className="text-red-500">-${totalProcessingFee.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="font-bold">Net to campaign owners</span>
            <span className="font-bold text-green-600">${totalNet.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={() => setResults("submitting")}
          className="w-full py-4 rounded-xl font-bold text-white bg-[#0070ba] hover:bg-[#005ea6] shadow-lg mb-4"
        >
          Process Migration
        </button>
      </div>
    </div>
  );
}
