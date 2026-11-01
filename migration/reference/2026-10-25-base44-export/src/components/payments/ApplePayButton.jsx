import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadApplePayScript, loadPayPalSdk } from "./paypalScripts";
import { computePayPalWalletBreakdown, MIN_DONATION } from "@/lib/fees";

// PayPal v5 Apple Pay: no separate merchant, ledger, or processor account.
// The button is shown ONLY if the device and the PayPal merchant are eligible,
// and the admin has opened the Apple Pay feature gate for campaign checkout.
export default function ApplePayButton({
  campaign, amount, donorName, message, platformContribution, onPaid, onReadyChange,
}) {
  const hostRef = useRef(null);
  const intentRef = useRef({ key: "", id: "" });
  const busyRef = useRef(false);
  const latestRef = useRef({ donorName, message, onPaid });
  const [state, setState] = useState("loading");
  useEffect(() => { latestRef.current = { donorName, message, onPaid }; });

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    onReadyChange?.(false);
    busyRef.current = false;
    const value = Number(amount);
    const selectedContribution = !!platformContribution;
    const allocation = computePayPalWalletBreakdown(value, selectedContribution);
    if (!host || !campaign?.id || !Number.isFinite(value) || value < MIN_DONATION || !(allocation.recipientGift > 0)) {
      setState("noamount");
      return undefined;
    }

    const intentKey = [campaign.id, value.toFixed(2), "applepay", selectedContribution ? "1" : "0"].join("|");
    if (intentRef.current.key !== intentKey) {
      intentRef.current = { key: intentKey, id: crypto.randomUUID() };
    }
    const intentId = intentRef.current.id;
    setState("loading");

    async function init() {
      try {
        // Apple Pay is not supported by every embedded Android/iOS WebView.
        // Never display a dead button just because IFund has a PayPal client ID.
        await loadApplePayScript();
        if (cancelled || !window.ApplePaySession?.canMakePayments?.()) {
          if (!cancelled) setState("unavailable");
          return;
        }
        const { data: config } = await base44.functions.invoke("getPayPalConfig", {});
        if (cancelled) return;
        if (config?.api_live !== true || !config.client_id || config.mode !== "live") {
          setState("unavailable");
          return;
        }
        await loadPayPalSdk(config.client_id);
        if (cancelled || !window.paypal?.Applepay) {
          if (!cancelled) setState("unavailable");
          return;
        }
        const applepay = window.paypal.Applepay();
        const eligibility = await applepay.config();
        if (cancelled) return;
        if (eligibility?.isEligible !== true ||
          !Array.isArray(eligibility.supportedNetworks) || !eligibility.supportedNetworks.length ||
          !Array.isArray(eligibility.merchantCapabilities) || !eligibility.merchantCapabilities.length ||
          !eligibility.countryCode) {
          setState("unavailable");
          return;
        }

        const beginPayment = () => {
          if (busyRef.current || cancelled) return;
          busyRef.current = true;
          let session;
          let authorized = false;
          try {
            // Apple requires the session to be created synchronously from a user gesture.
            session = new window.ApplePaySession(4, {
              countryCode: eligibility.countryCode,
              merchantCapabilities: eligibility.merchantCapabilities,
              supportedNetworks: eligibility.supportedNetworks,
              currencyCode: "USD",
              requiredBillingContactFields: ["postalAddress"],
              total: {
                label: "Interplanetary Fund",
                type: "final",
                amount: allocation.totalCharged.toFixed(2),
              },
            });
          } catch (_) {
            busyRef.current = false;
            if (!cancelled) setState("unavailable");
            return;
          }

          session.onvalidatemerchant = async (event) => {
            try {
              const validated = await applepay.validateMerchant({
                validationUrl: event.validationURL,
                displayName: "Interplanetary Fund",
              });
              if (!validated?.merchantSession) throw new Error("Merchant validation unavailable");
              session.completeMerchantValidation(validated.merchantSession);
            } catch (_) {
              busyRef.current = false;
              session.abort();
              if (!cancelled) setState("unavailable");
            }
          };

          session.onpaymentauthorized = async (event) => {
            authorized = true;
            if (!cancelled) setState("processing");
            let confirmedWithProvider = false;
            try {
              const { data: order } = await base44.functions.invoke("createPayPalOrder", {
                campaign_id: campaign.id,
                amount: value,
                platform_contribution: selectedContribution,
                intent_id: intentId,
                payment_channel: "applepay",
              });
              if (!order?.id || typeof order.id !== "string") throw new Error("Unable to create order");
              const result = await applepay.confirmOrder({
                orderId: order.id,
                token: event.payment.token,
                billingContact: event.payment.billingContact,
              });
              if (result?.status !== "APPROVED") throw new Error("Payment authorization not approved");
              confirmedWithProvider = true;
              const { data: captured } = await base44.functions.invoke("capturePayPalOrder", {
                order_id: order.id,
                campaign_id: campaign.id,
                donor_name: latestRef.current.donorName || "Anonymous",
                message: latestRef.current.message || "",
                is_recurring: false,
              });
              if (captured?.ok !== true || !captured.canonical_operation_id) {
                throw new Error("Donation accounting pending confirmation");
              }
              session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
              if (!cancelled) latestRef.current.onPaid?.(captured);
            } catch (_) {
              // After provider authorization the charge state may be ambiguous;
              // do not invite an immediate second payment with a fresh order.
              session.completePayment(window.ApplePaySession.STATUS_FAILURE);
              if (!cancelled) setState(confirmedWithProvider ? "review" : "unavailable");
              busyRef.current = false;
            }
          };

          session.oncancel = () => {
            if (!authorized) {
              busyRef.current = false;
              if (!cancelled) setState("ready");
            }
          };
          try {
            session.begin();
          } catch (_) {
            busyRef.current = false;
            if (!cancelled) setState("unavailable");
          }
        };

        const button = document.createElement("apple-pay-button");
        button.setAttribute("buttonstyle", "black");
        // "donate" is reserved for approved nonprofits; IFund campaigns can be
        // personal/business fundraisers, so use the general-purpose "buy" type.
        button.setAttribute("type", "buy");
        button.setAttribute("locale", "en-US");
        button.setAttribute("aria-label", "Pay with Apple Pay");
        button.style.setProperty("--apple-pay-button-width", "100%");
        button.style.setProperty("--apple-pay-button-height", "46px");
        button.style.setProperty("--apple-pay-button-border-radius", "12px");
        button.addEventListener("click", beginPayment);
        host.replaceChildren(button);
        setState("ready");
        onReadyChange?.(true);
      } catch (_) {
        if (!cancelled) setState("unavailable");
      }
    }

    init();
    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [campaign?.id, amount, platformContribution, onReadyChange]);

  return (
    <div>
      <div className={state === "ready" ? "block" : "hidden"} ref={hostRef} aria-label="Apple Pay checkout" />
      {state === "processing" && <p role="status" className="text-xs text-stone-600">Confirming your payment securely…</p>}
      {state === "review" && <p role="alert" className="text-xs text-amber-800">Your payment was authorized, but we could not confirm its donation record. Please check your receipt or contact support before trying again.</p>}
    </div>
  );
}
