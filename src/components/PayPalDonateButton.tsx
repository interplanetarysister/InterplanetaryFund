/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState } from "react";

interface PayPalDonateButtonProps {
  campaignId: string;
  campaignTitle: string;
  businessEmail?: string;
}

export function PayPalDonateButton({
  campaignId,
  campaignTitle,
  businessEmail = "interplanetarysister@gmail.com",
}: PayPalDonateButtonProps) {
  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const presetAmounts = [10, 25, 50, 100];

  const handleDonate = (presetAmount?: number) => {
    const donationAmount = presetAmount || parseFloat(amount);
    if (!donationAmount || donationAmount < 1) {
      alert("Please enter an amount of at least $1");
      return;
    }

    // Build PayPal donate URL
    const paypalUrl = new URL("https://www.paypal.com/donate");
    paypalUrl.searchParams.set("cmd", "_donations");
    paypalUrl.searchParams.set("business", businessEmail);
    paypalUrl.searchParams.set("item_name", `${campaignTitle} - Interplanetary Fund`);
    paypalUrl.searchParams.set("amount", donationAmount.toString());
    paypalUrl.searchParams.set("currency_code", "USD");
    // Track which campaign this donation is for
    paypalUrl.searchParams.set("custom", campaignId);
    // Note: actual donation record creation requires Convex deployment
    // and PayPal IPN (Instant Payment Notification) setup

    window.open(paypalUrl.toString(), "_blank");
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 px-6 rounded-xl font-bold text-white bg-[#0070ba] hover:bg-[#005ea6] transition-colors shadow-lg"
        >
          💝 Donate Now
        </button>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-4 space-y-3">
          <h3 className="font-bold text-lg text-center">Choose Amount</h3>
          
          <div className="grid grid-cols-4 gap-2">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => handleDonate(amt)}
                className="py-2 rounded-lg border-2 border-gray-200 hover:border-[#0070ba] hover:bg-blue-50 font-semibold transition-colors"
              >
                ${amt}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <span className="flex items-center font-semibold">$</span>
            <input
              type="number"
              min="1"
              placeholder="Custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#0070ba] outline-none"
            />
            <button
              onClick={() => handleDonate()}
              className="px-6 py-2 rounded-lg font-bold text-white bg-[#0070ba] hover:bg-[#005ea6] transition-colors"
            >
              Donate
            </button>
          </div>

          <input
            type="text"
            placeholder="Your name (optional)"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#0070ba] outline-none"
          />

          <p className="text-xs text-gray-500 text-center">
            You'll be redirected to PayPal to complete your donation securely.
          </p>
          
          <button
            onClick={() => setShowForm(false)}
            className="w-full text-gray-500 text-sm hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
