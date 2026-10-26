import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadPayPalSdk, loadGooglePayScript } from "./paypalScripts";
import { computePayPalWalletBreakdown, MIN_DONATION } from "@/lib/fees";

// Google Pay and PayPal Buttons deliberately share the same v5 PayPal SDK.
// Only show this button when the wallet, device, and merchant are eligible.
export default function GooglePayButton({ campaign, amount, donorName, message, recurring, platformContribution, onPaid, onReadyChange }) {
  const containerRef = useRef(null);
  const intentRef = useRef({ key: "", id: "" });
  const [state, setState] = useState("loading");
  const propsRef = useRef({ donorName, message, recurring, onPaid });
  useEffect(() => { propsRef.current = { donorName, message, recurring, onPaid }; });

  useEffect(() => {
    onReadyChange?.(false);
    let cancelled = false;

    async function init() {
      const value = Number(amount);
      const selectedContribution = !!platformContribution;
      const allocation = computePayPalWalletBreakdown(value, selectedContribution);
      if (!campaign?.id || !Number.isFinite(value) || value < MIN_DONATION || !(allocation.recipientGift > 0)) {
        setState("noamount");
        return;
      }
      const financialIntentKey = [campaign.id, value.toFixed(2), "googlepay", selectedContribution ? "1" : "0"].join("|");
      if (intentRef.current.key !== financialIntentKey) {
        intentRef.current = { key: financialIntentKey, id: crypto.randomUUID() };
      }
      const intentId = intentRef.current.id;

      setState("loading");
      try {
        const { data: config } = await base44.functions.invoke("getPayPalConfig", {});
        if (cancelled) return;
        if (config?.api_live !== true || !config?.client_id) {
          setState("unavailable");
          return;
        }
        await Promise.all([loadPayPalSdk(config.client_id), loadGooglePayScript()]);
        if (cancelled) return;
        if (!window.paypal?.Googlepay || !window.google?.payments?.api) {
          setState("unavailable");
          return;
        }

        const paypalGooglePay = window.paypal.Googlepay();
        const paymentConfig = await paypalGooglePay.config();
        if (!paymentConfig?.allowedPaymentMethods?.length || !paymentConfig?.merchantInfo) {
          setState("unavailable");
          return;
        }

        const paymentsClient = new window.google.payments.api.PaymentsClient({
          environment: config.mode === "live" ? "PRODUCTION" : "TEST",
          paymentDataCallbacks: {
            onPaymentAuthorized: async (paymentData) => {
              const failure = { transactionState: "ERROR", error: { intent: "PAYMENT_AUTHORIZATION", message: "Payment could not be confirmed safely. Please try again." } };
              try {
                const current = propsRef.current;
                const { data: order } = await base44.functions.invoke("createPayPalOrder", {
                  campaign_id: campaign.id,
                  amount: value,
                  platform_contribution: selectedContribution,
                  intent_id: intentId,
                  payment_channel: "googlepay",
                });
                if (!order?.id || typeof order.id !== "string") return failure;

                const confirmation = await paypalGooglePay.confirmOrder({
                  orderId: order.id,
                  paymentMethodData: paymentData.paymentMethodData,
                });
                if (confirmation?.status === "PAYER_ACTION_REQUIRED") {
                  await paypalGooglePay.initiatePayerAction({ orderId: order.id });
                } else if (confirmation?.status !== "APPROVED") {
                  return failure;
                }

                const { data: result } = await base44.functions.invoke("capturePayPalOrder", {
                  order_id: order.id,
                  campaign_id: campaign.id,
                  donor_name: current.donorName || "Anonymous",
                  message: current.message || "",
                  is_recurring: !!current.recurring,
                });
                if (result?.ok !== true || !result.canonical_operation_id) return failure;
                if (!cancelled) current.onPaid?.(result);
                return { transactionState: "SUCCESS" };
              } catch (_) {
                return failure;
              }
            },
          },
        });

        const eligible = await paymentsClient.isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: paymentConfig.allowedPaymentMethods,
        });
        if (cancelled) return;
        if (!eligible?.result) { setState("unavailable"); return; }

        const button = paymentsClient.createButton({
          onClick: () => {
            paymentsClient.loadPaymentData({
              apiVersion: 2,
              apiVersionMinor: 0,
              allowedPaymentMethods: paymentConfig.allowedPaymentMethods,
              merchantInfo: paymentConfig.merchantInfo,
              transactionInfo: {
                countryCode: "US",
                currencyCode: "USD",
                totalPriceStatus: "FINAL",
                totalPrice: allocation.totalCharged.toFixed(2),
              },
              callbackIntents: ["PAYMENT_AUTHORIZATION"],
            }).catch(() => {
              // Google Pay can be cancelled by the buyer without a failed donation.
            });
          },
        });
        if (cancelled) return;
        containerRef.current?.replaceChildren(button);
        setState("ready");
        onReadyChange?.(true);
      } catch (_) {
        if (!cancelled) setState("unavailable");
      }
    }

    init();
    return () => {
      cancelled = true;
      containerRef.current?.replaceChildren();
    };
  }, [campaign?.id, amount, platformContribution, onReadyChange]);

  // Keep the host mounted while initializing so the SDK has a DOM node to attach to.
  return <div className={state === "ready" ? "block" : "hidden"}><div ref={containerRef} className="gpay-host [&_button]:w-full" aria-label="Google Pay checkout" /></div>;
}
