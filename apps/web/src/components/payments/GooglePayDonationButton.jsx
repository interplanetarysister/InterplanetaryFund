import React, { useEffect, useRef, useState } from "react";

// The production checkout uses PayPal JavaScript SDK v5 for hosted CardFields
// and Buttons. Google Pay must use the *same* SDK instance, not v6.
let googleScriptPromise;
function loadGooglePay() {
  if (window.google?.payments?.api) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://pay.google.com/gp/p/js/pay.js";
      script.async = true;
      script.onload = () => window.google?.payments?.api
        ? resolve() : reject(new Error("Google Pay SDK unavailable"));
      script.onerror = () => reject(new Error("Google Pay SDK unavailable"));
      document.head.appendChild(script);
    }).catch(error => { googleScriptPromise = null; throw error; });
  }
  return googleScriptPromise;
}

export default function GooglePayDonationButton({
  campaignId, amountCents, enabled, begin, capture,
}) {
  const host = useRef(null);
  const current = useRef({ begin, capture });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { current.current = { begin, capture }; });

  useEffect(() => {
    let cancelled = false;
    const container = host.current;
    setReady(false);
    setError("");
    if (!enabled || !campaignId || !Number.isSafeInteger(amountCents) || amountCents < 100)
      return undefined;
    (async () => {
      try {
        await loadGooglePay();
        if (cancelled || typeof window.paypal?.Googlepay !== "function") return;
        const paypalGooglePay = window.paypal.Googlepay();
        // PayPal config doubles as the merchant eligibility gate.
        const config = await paypalGooglePay.config();
        if (cancelled || !config?.allowedPaymentMethods?.length || !config.merchantInfo) return;
        const client = new window.google.payments.api.PaymentsClient({
          environment: "PRODUCTION",
          paymentDataCallbacks: {
            onPaymentAuthorized: async paymentData => {
              const failure = message => ({
                transactionState: "ERROR",
                error: { intent: "PAYMENT_AUTHORIZATION", message },
              });
              try {
                if (cancelled) return failure("Checkout was closed");
                const orderId = await current.current.begin("googlepay");
                const confirmation = await paypalGooglePay.confirmOrder({
                  orderId,
                  paymentMethodData: paymentData.paymentMethodData,
                });
                if (confirmation?.status === "PAYER_ACTION_REQUIRED") {
                  const action = await paypalGooglePay.initiatePayerAction({ orderId });
                  if (!action || action.liabilityShift === "NO")
                    return failure("Additional bank verification was not completed");
                } else if (confirmation?.status !== "APPROVED") {
                  return failure("The payment was not authorized");
                }
                // This endpoint verifies PayPal's captured transaction, signed
                // ledger intent and exact cents, then persists the donation once.
                await current.current.capture({ orderID: orderId });
                return { transactionState: "SUCCESS" };
              } catch (_) {
                if (!cancelled) setError("Google Pay could not confirm your donation. If you approved a payment, check your receipt or My Giving before retrying.");
                return failure("Payment could not be confirmed. Check your receipt before retrying.");
              }
            },
          },
        });
        const eligible = await client.isReadyToPay({
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: config.allowedPaymentMethods,
        });
        if (cancelled || !eligible?.result) return;
        const button = client.createButton({
          buttonColor: "black",
          buttonType: "donate",
          onClick: () => {
            if (cancelled) return;
            setError("");
            client.loadPaymentData({
              apiVersion: 2,
              apiVersionMinor: 0,
              allowedPaymentMethods: config.allowedPaymentMethods,
              merchantInfo: config.merchantInfo,
              transactionInfo: {
                countryCode: config.countryCode || "US",
                currencyCode: "USD",
                totalPriceStatus: "FINAL",
                totalPrice: (amountCents / 100).toFixed(2),
                totalPriceLabel: "Interplanetary Fund donation",
              },
              callbackIntents: ["PAYMENT_AUTHORIZATION"],
            }).catch(() => {
              // Closing Google Pay without authorizing is not a failed charge.
            });
          },
        });
        if (!cancelled) {
          container?.replaceChildren(button);
          setReady(true);
        }
      } catch (_) {
        // Ineligible devices or merchants must retain working PayPal/card options.
        if (!cancelled) setReady(false);
      }
    })();
    return () => {
      cancelled = true;
      container?.replaceChildren();
    };
  }, [campaignId, amountCents, enabled]);

  return <div className={ready ? "space-y-2" : "hidden"}>
    <div ref={host} aria-label="Secure Google Pay donation button"
      className="[&_button]:!w-full [&_button]:!min-h-11" />
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
