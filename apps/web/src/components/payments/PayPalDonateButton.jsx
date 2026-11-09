import React from "react";
import PlatformSupportHostedButton from "@/components/payments/PlatformSupportHostedButton";

// Compatibility wrapper for existing platform-support placements.
// All IFund platform-support CTAs use the same owner-supplied hosted button.
// Campaign checkout remains a separate, campaign-attributed payment flow.
export default function PayPalDonateButton({ label = "Support Interplanetary Fund" }) {
  return <PlatformSupportHostedButton label={label} />;
}
