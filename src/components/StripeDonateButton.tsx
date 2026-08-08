/*
 * Interplanetary Fund — Stripe Donate Button Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Uses Stripe Checkout Hosted page via Convex backend.
 * No Stripe.js SDK needed on frontend — redirect-based flow.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface StripeDonateButtonProps {
  campaignId: string;
  campaignTitle: string;
}

export function StripeDonateButton({ campaignId, campaignTitle }: StripeDonateButtonProps) {
  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useMutation(api.stripeCheckout.createCheckoutSession);
  const keyInfo = useQuery(api.stripeCheckout.getPublishableKey, {});

  const presetAmounts = [10, 25, 50, 100];

  const handleDonate = async (presetAmount?: number) => {
    const donationAmount = presetAmount || parseFloat(amount);
    if (!donationAmount || donationAmount < 1) {
      setError("Please enter an amount of at least $1");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createSession({
        campaignId,
        campaignTitle,
        amount: donationAmount,
        donorName: donorName || "Anonymous",
        donorEmail: donorEmail || undefined,
        message: message || undefined,
      });

      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        setError("Failed to create checkout session. Please try again.");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Don't render if Stripe is not configured
  if (keyInfo && !keyInfo.isActive) {
    return null;
  }

  return (
    <div className="w-full">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-[#635bff] hover:bg-[#5851ea] transition-colors shadow-md flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg" fill="white">
            <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.63 0 2.93-.36 4.02-.97v2.18c-1.14.6-2.68.96-4.66.96-4.08 0-6.84-2.47-6.84-6.92 0-4.35 2.54-7.03 6.44-7.03 3.56 0 5.95 2.42 5.95 6.93 0 .28-.02.73-.05 1.28zm-5.92-5.56c-1.58 0-2.27 1.5-2.34 2.78h4.6c-.05-1.23-.62-2.78-2.26-2.78zM48.16 2.46l.56 3.15c-1.32.27-2.56.43-3.45.43v14.24h-3.55V6.48c-.9 0-2.13-.16-3.45-.43l.56-3.15c2.3 0 3.96.27 9.33.43zM37.73 17.3c1.5 0 2.57-1.3 2.57-2.88 0-1.58-1.07-2.88-2.57-2.88-1.5 0-2.57 1.3-2.57 2.88 0 1.58 1.07 2.88 2.57 2.88z"/>
          </svg>
          Donate with Card
        </button>
      ) : (
        <div className="bg-ifcard rounded-xl p-4 space-y-3 border border-ifborder">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-iftext">Card Donation</h3>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="text-iftext/50 hover:text-iftext text-xs"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {presetAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => handleDonate(amt)}
                disabled={loading}
                className="py-2 rounded-lg border-2 border-ifborder hover:border-[#635bff] hover:bg-[#635bff]/10 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                ${amt}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <span className="flex items-center font-semibold text-iftext text-sm">$</span>
            <input
              type="number"
              min="1"
              placeholder="Custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-3 py-2 border-2 border-ifborder rounded-lg focus:border-[#635bff] outline-none text-sm bg-transparent text-iftext"
            />
            <button
              onClick={() => handleDonate()}
              disabled={loading || (!amount && true)}
              className="px-4 py-2 rounded-lg font-semibold text-white bg-[#635bff] hover:bg-[#5851ea] transition-colors text-sm disabled:opacity-50"
            >
              {loading ? "..." : "Donate"}
            </button>
          </div>

          <input
            type="text"
            placeholder="Your name (optional)"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            className="w-full px-3 py-2 border-2 border-ifborder rounded-lg focus:border-[#635bff] outline-none text-sm bg-transparent text-iftext"
          />

          <input
            type="email"
            placeholder="Email (optional, for receipt)"
            value={donorEmail}
            onChange={(e) => setDonorEmail(e.target.value)}
            className="w-full px-3 py-2 border-2 border-ifborder rounded-lg focus:border-[#635bff] outline-none text-sm bg-transparent text-iftext"
          />

          {error && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <p className="text-xs text-iftext/50 text-center">
            You'll be redirected to Stripe to complete your donation securely.
            Test mode: use card 4242 4242 4242 4242
          </p>
        </div>
      )}
    </div>
  );
}
