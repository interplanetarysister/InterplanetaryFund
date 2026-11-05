import React, { useEffect, useRef, useState } from "react";

// PayPal hosted button supplied by the IFund owner on November 5, 2026.
// This is a fixed $25 platform-support payment, NOT campaign checkout.
const HOSTED_ID = "GT3RRRVBG4E5Y";
const CLIENT_ID = "BAAC5OeGibmx5Rq9xWFqsgzyfLx16xyCz415fe046Giq0E-Y7xqJyf3h2KnTChXWjRMbVnsrowVRDWqJMs";
const SDK_ID = "ifund-paypal-hosted-sdk";

export default function PlatformSupportHostedButton() {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const render = () => {
      if (!active || !container.current || !window.paypal?.HostedButtons) return;
      container.current.replaceChildren();
      try {
        window.paypal.HostedButtons({ hostedButtonId: HOSTED_ID })
          .render(container.current).catch(() => { if (active) setFailed(true); });
      } catch {
        if (active) setFailed(true);
      }
    };
    if (window.paypal?.HostedButtons) render();
    else {
      let script = document.getElementById(SDK_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = SDK_ID;
        script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&components=hosted-buttons&enable-funding=venmo&currency=USD`;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      script.addEventListener("error", () => { if (active) setFailed(true); });
      return () => { active = false; script.removeEventListener("load", render); };
    }
    return () => { active = false; };
  }, []);
  return (
    <section aria-label="Support Interplanetary Fund" className="mx-auto w-full max-w-xl px-4 py-8 text-center">
      <h2 className="text-lg font-semibold">Fuel the Interplanetary Fund mission</h2>
      <p className="mt-2 mb-5 text-sm text-muted-foreground">
        Optional $25 one-time support for Interplanetary Fund operations.
        This payment does not contribute to any individual campaign.
      </p>
      <div ref={container} id="ifund-platform-support-paypal" className="min-h-[48px]" />
      {failed && <p role="status" className="text-sm">PayPal checkout could not load. Please try again later.</p>}
    </section>
  );
}
