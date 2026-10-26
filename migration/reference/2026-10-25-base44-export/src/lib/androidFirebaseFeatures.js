import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { base44 } from "@/api/base44Client";

export const isAndroidApp = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const Diagnostics = registerPlugin("IfundDiagnostics");
const TOKEN_KEY = "ifund_android_push_token";

export async function getCrashReporting() {
  if (!isAndroidApp) return false;
  const status = await Diagnostics.status();
  return status?.enabled === true;
}

export async function setCrashReporting(enabled) {
  if (!isAndroidApp || typeof enabled !== "boolean") throw new Error("Not an Android feature");
  const result = await Diagnostics.setEnabled({ enabled });
  if (result?.enabled !== enabled) throw new Error("Could not save crash report preference");
  return enabled;
}

export function hasLocalPushRegistration() {
  if (!isAndroidApp) return false;
  try { return !!window.localStorage.getItem(TOKEN_KEY); } catch { return false; }
}

// Called only after a signed-in member presses the opt-in button.
// The FCM token is never displayed, logged, or treated as an account credential.
export async function enableAndroidPush() {
  if (!isAndroidApp) throw new Error("Android only");
  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== "granted") throw new Error("Notification permission was not granted");

  const token = await new Promise((resolve, reject) => {
    let done = false;
    let listeners = [];
    const cleanup = () => {
      clearTimeout(timer);
      for (const listener of listeners) void listener.remove();
    };
    const finish = (err, value) => {
      if (done) return;
      done = true;
      cleanup();
      if (err) reject(err);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("Device registration timed out")), 20000);
    Promise.all([
      PushNotifications.addListener("registration", (result) => finish(null, result.value)),
      PushNotifications.addListener("registrationError", () => finish(new Error("Device registration failed"))),
    ]).then((handlers) => {
      if (done) { for (const handle of handlers) void handle.remove(); return; }
      listeners = handlers;
      return PushNotifications.register().catch(finish);
    }).catch(finish);
  });

  if (typeof token !== "string" || token.length < 32) throw new Error("Invalid notification registration");
  const response = await base44.functions.invoke("registerPushDevice", {
    mode: "register", platform: "android", token,
  });
  const data = response?.data || response;
  if (data?.ok !== true || data?.enabled !== true) {
    await PushNotifications.unregister().catch(() => {});
    throw new Error("IFund could not save this device registration");
  }
  window.localStorage.setItem(TOKEN_KEY, token);
  return true;
}

// Best-effort revocation when signing out; native unregistration occurs even
// if the backend is offline. No notifications will be sent to a logged-out
// device merely because it used this app previously.
export async function disableAndroidPush() {
  if (!isAndroidApp) return;
  const token = window.localStorage.getItem(TOKEN_KEY);
  let revoked = !token;
  if (token) {
    try {
      const response = await base44.functions.invoke("registerPushDevice", {
        mode: "revoke", platform: "android", token,
      });
      revoked = (response?.data || response)?.ok === true;
    } catch { /* Network failure must not trap the user in an account. */ }
  }
  try { await PushNotifications.unregister(); } finally {
    window.localStorage.removeItem(TOKEN_KEY);
  }
  return revoked;
}
