import React, { useEffect, useRef, useState } from "react";
import { authClient } from "@/api/auth";
import { loadPayPalSdk } from "./paypalScripts";

async function authHeaders() {
  try {
    const { data, error } = await authClient().auth.getSession();
    if (!error && data?.session?.access_token) {
      return { Authorization: "Bearer " + data.session.access_token };
    }
  } catch {
    // Anonymous campaign gifts are supported; no browser secret is required.
  }
  return {};
}

async function postPayment(path, payload) {
  const headers = await authHeaders();
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "PayPal checkout could not be completed.");
  return result;
}

export default function PayPalCheckoutButton({
  campaign, amount, optionalSupport, clientId, onPaid, onCheckoutStart, onCheckoutEnd, onError,
}) {
  const containerRef = useRef(null);
  const buttonsRef = useRef(null);
  const latestRef = useRef({ onPaid, onCheckoutStart, onCheckoutEnd, onError });
  const [error, setError] = useState("");

  useEffect(() => {
    latestRef.current = { onPaid, onCheckoutStart, onCheckoutEnd, onError };
  });

  useEffect(() => {
    let cancelled = false;
    const node = containerRef.current;
    const giftAmount = Number(amount);
    if (!node || !campaign?.id || !clientId || !Number.isFinite(giftAmount) ||
        giftAmount < 1 || giftAmount > 1000000) return undefined;

    const intentId = globalThis.crypto?.randomUUID?.();
    if (!intentId) {
      setError("Secure payment identification is unavailable in this browser.");
      return undefined;
    }

    (async () => {
      try {
        setError("");
        await loadPayPalSdk(clientId);
        if (cancelled || !window.paypal?.Buttons) return;
        node.replaceChildren();
        const buttons = window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal", height: 44, tagline: false },
          onClick: () => latestRef.current.onCheckoutStart?.(),
          createOrder: async () => {
            const result = await postPayment("/api/payments/paypal/create-order", {
              campaign_id: campaign.id,
              gift_amount: giftAmount,
              optional_support: optionalSupport === true,
              intent_id: intentId,
            });
            if (!result?.id) throw new Error("PayPal did not return a valid order.");
            return result.id;
          },
          onApprove: async (data) => {
            try {
              const orderId = String(data?.orderID || "");
              if (!orderId) throw new Error("PayPal did not return an order ID.");
              const result = await postPayment("/api/payments/paypal/capture-order", {
                order_id: orderId,
                campaign_id: campaign.id,
              });
              if (result?.reconciliation_pending === true) {
                throw new Error("PayPal reports a completed payment that IFund is still reconciling. Do not submit another payment.");
              }
              if (result?.ok !== true || typeof result?.canonical_operation_id !== "string") {
                throw new Error("The payment has not yet been verified and recorded.");
              }
              if (!cancelled) latestRef.current.onPaid?.(result);
            } catch (cause) {
              if (!cancelled) {
                const message = cause?.message || "The payment is being reconciled. Do not submit another payment.";
                setError(message);
                latestRef.current.onError?.(message);
              }
            } finally {
              latestRef.current.onCheckoutEnd?.();
            }
          },
          onCancel: () => {
            latestRef.current.onCheckoutEnd?.();
            if (!cancelled) setError("");
          },
          onError: () => {
            latestRef.current.onCheckoutEnd?.();
            if (!cancelled) setError("PayPal could not complete the payment. Campaign totals update only after IFund verifies the capture.");
          },
        });
        buttonsRef.current = buttons;
        await buttons.render(node);
      } catch (cause) {
        latestRef.current.onCheckoutEnd?.();
        if (!cancelled) {
          const message = cause?.message || "PayPal checkout is temporarily unavailable.";
          setError(message);
          latestRef.current.onError?.(message);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { buttonsRef.current?.close?.(); } catch { /* SDK cleanup is best-effort. */ }
      buttonsRef.current = null;
      node.replaceChildren();
    };
  }, [campaign?.id, amount, optionalSupport, clientId]);

  return (
    <div className="w-full min-w-0 space-y-2">
      <div ref={containerRef} className="w-full min-w-0 overflow-visible [&_iframe]:max-w-full" aria-label="PayPal checkout" />
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
