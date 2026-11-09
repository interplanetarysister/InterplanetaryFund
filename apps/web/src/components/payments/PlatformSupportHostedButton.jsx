import React, { useEffect, useRef, useState } from "react";
import { IFUND_PLATFORM_SUPPORT_PAYMENT_LINK } from "@/lib/paypalLink";

// Owner-supplied PayPal hosted button. This is a fixed $25 platform-support
// payment, never an individual campaign donation or campaign checkout.
const HOSTED_ID = "GT3RRRVBG4E5Y";
const CLIENT_ID = "BAAC5OeGibmx5Rq9xWFqsgzyfLx16xyCz415fe046Giq0E-Y7xqJyf3h2KnTChXWjRMbVnsrowVRDWqJMs";
const SDK_ID = "ifund-paypal-hosted-sdk";
const SDK_URL = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&components=hosted-buttons&enable-funding=venmo&currency=USD`;

let hostedSdkPromise;

function loadHostedButtonsSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("PayPal checkout is browser-only."));
  if (window.paypal?.HostedButtons) return Promise.resolve(window.paypal);
  if (hostedSdkPromise) return hostedSdkPromise;

  hostedSdkPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(SDK_ID);
    if (!script) {
      script = document.createElement("script");
      script.id = SDK_ID;
      script.src = SDK_URL;
      script.async = true;
    }

    const cleanup = () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      if (window.paypal?.HostedButtons) resolve(window.paypal);
      else {
        hostedSdkPromise = null;
        reject(new Error("PayPal hosted buttons did not initialize."));
      }
    };
    const onError = () => {
      cleanup();
      script.remove();
      hostedSdkPromise = null;
      reject(new Error("PayPal checkout could not load."));
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (!script.isConnected) document.head.appendChild(script);
  }).catch((error) => {
    hostedSdkPromise = null;
    throw error;
  });

  return hostedSdkPromise;
}

export default function PlatformSupportHostedButton({
  label = "Fuel the Interplanetary Fund mission",
  description = "Optional $25 one-time support for Interplanetary Fund operations. This payment does not contribute to any individual campaign.",
}) {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadHostedButtonsSdk()
      .then((paypal) => {
        if (!active || !container.current) return null;
        container.current.replaceChildren();
        return Promise.resolve(
          paypal.HostedButtons({ hostedButtonId: HOSTED_ID }).render(container.current)
        );
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      container.current?.replaceChildren();
    };
  }, []);

  return (
    <section aria-label="Support Interplanetary Fund" className="mx-auto w-full max-w-xl px-4 py-8 text-center">
      <h2 className="text-lg font-semibold">{label}</h2>
      <p className="mt-2 mb-5 text-sm text-muted-foreground">{description}</p>
      <div ref={container} id="ifund-platform-support-paypal" className="min-h-[48px]" />
      {failed && (
        <div className="space-y-2">
          <p role="status" className="text-sm">PayPal's hosted button could not load. You can still continue through the official PayPal payment link.</p>
          <a
            href={IFUND_PLATFORM_SUPPORT_PAYMENT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#FFD140] px-5 py-3 text-sm font-semibold text-[#003087] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#003087]"
          >
            Continue with PayPal
          </a>
        </div>
      )}
    </section>
  );
}
