// Use one consistent PayPal JavaScript SDK version for PayPal Buttons, Google Pay, and Apple Pay.
// All integrations below use v5: paypal.Buttons(), paypal.Googlepay(), and paypal.Applepay().
// Never mix this script with the v6 createInstance() interface.

let gpayPromise = null;
export function loadGooglePayScript() {
  if (gpayPromise) return gpayPromise;
  gpayPromise = new Promise((resolve, reject) => {
    if (window.google?.payments?.api) return resolve();
    const s = document.createElement("script");
    s.src = "https://pay.google.com/gp/p/js/pay.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gpayPromise = null; reject(new Error("Failed to load Google Pay")); };
    document.head.appendChild(s);
  });
  return gpayPromise;
}

let applePayPromise = null;
// PayPal's v5 Apple Pay component uses Apple's browser session + button SDK.
export function loadApplePayScript() {
  if (applePayPromise) return applePayPromise;
  applePayPromise = new Promise((resolve, reject) => {
    if (window.customElements?.get("apple-pay-button")) return resolve();
    const s = document.createElement("script");
    s.src = "https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { applePayPromise = null; reject(new Error("Apple Pay SDK unavailable")); };
    document.head.appendChild(s);
  });
  return applePayPromise;
}

let ppPromise = null;
let ppClientId = null;
export function loadPayPalSdk(clientId) {
  if (!clientId) return Promise.reject(new Error("PayPal client ID is required"));
  if (ppPromise) {
    if (ppClientId !== clientId) return Promise.reject(new Error("PayPal checkout configuration changed; reload the page"));
    return ppPromise;
  }
  ppClientId = clientId;
  ppPromise = new Promise((resolve, reject) => {
    // Google Pay may be ineligible for this merchant; PayPal Buttons must still work.
    if (window.paypal?.Buttons) return resolve();
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons,googlepay,applepay&intent=capture&currency=USD`;
    script.async = true;
    script.onload = () => {
      if (window.paypal?.Buttons) resolve();
      else reject(new Error("PayPal SDK did not provide PayPal Buttons"));
    };
    script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    const resetOnFailure = () => { script.remove(); ppPromise = null; ppClientId = null; };
    script.addEventListener("error", resetOnFailure, { once: true });
    document.head.appendChild(script);
  }).catch((error) => { ppPromise = null; ppClientId = null; throw error; });
  return ppPromise;
}