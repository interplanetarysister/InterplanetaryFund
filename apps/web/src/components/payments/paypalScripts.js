let paypalPromise = null;
let paypalClientId = null;

export function loadPayPalSdk(clientId) {
  if (!clientId) return Promise.reject(new Error("PayPal client ID is required."));
  if (paypalPromise) {
    if (paypalClientId !== clientId) {
      return Promise.reject(new Error("PayPal checkout configuration changed. Reload the page."));
    }
    return paypalPromise;
  }
  paypalClientId = clientId;
  paypalPromise = new Promise((resolve, reject) => {
    if (window.paypal?.Buttons) return resolve();
    const script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=" +
      encodeURIComponent(clientId) + "&components=buttons&intent=capture&currency=USD";
    script.async = true;
    script.onload = () => window.paypal?.Buttons
      ? resolve()
      : reject(new Error("PayPal SDK did not provide PayPal Buttons."));
    script.onerror = () => reject(new Error("PayPal SDK could not be loaded."));
    document.head.appendChild(script);
  }).catch((error) => {
    paypalPromise = null;
    paypalClientId = null;
    throw error;
  });
  return paypalPromise;
}
