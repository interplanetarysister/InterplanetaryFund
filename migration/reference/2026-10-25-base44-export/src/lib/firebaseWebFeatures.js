import { Capacitor } from "@capacitor/core";
import { IFUND_FIREBASE_WEB_CONFIG } from "./firebaseWebConfig";

// Browser-local, explicit opt-in. None of the Firebase SDKs are loaded
// on normal visits or inside the native Android application.
export const WEB_DIAGNOSTICS_CONSENT_KEY = "ifund_web_diagnostics_opt_in_v1";
const FIREBASE_APP_NAME = "ifund-optional-web-diagnostics";
let services = null;
let pending = null;
let installed = false;

const isWeb = () => typeof window !== "undefined" && !Capacitor.isNativePlatform();

export function hasWebDiagnosticsConsent() {
  if (!isWeb()) return false;
  try { return window.localStorage.getItem(WEB_DIAGNOSTICS_CONSENT_KEY) === "yes"; }
  catch { return false; }
}

function applyEnabledState(enabled) {
  if (!services) return;
  if (services.analytics && services.analyticsSdk) {
    services.analyticsSdk.setConsent({
      analytics_storage: enabled ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    services.analyticsSdk.setAnalyticsCollectionEnabled(services.analytics, enabled);
  }
  if (services.performance) {
    services.performance.instrumentationEnabled = enabled;
    services.performance.dataCollectionEnabled = enabled;
  }
}

export async function applyWebDiagnosticsConsent() {
  if (!isWeb()) return false;
  if (!hasWebDiagnosticsConsent()) {
    applyEnabledState(false);
    return false;
  }
  if (services) {
    applyEnabledState(true);
    return Boolean(services.analytics || services.performance);
  }
  if (pending) return pending;
  pending = (async () => {
    const [{ initializeApp, getApps }, analyticsSdk, performanceSdk] = await Promise.all([
      import("firebase/app"),
      import("firebase/analytics").catch(() => null),
      import("firebase/performance").catch(() => null),
    ]);
    // Consent may have been withdrawn while asynchronous chunks loaded.
    if (!hasWebDiagnosticsConsent()) return false;
    const app = getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME)
      || initializeApp(IFUND_FIREBASE_WEB_CONFIG, FIREBASE_APP_NAME);
    const next = { analytics: null, analyticsSdk: null, performance: null };
    if (analyticsSdk && await analyticsSdk.isSupported().catch(() => false)) {
      try {
        next.analyticsSdk = analyticsSdk;
        next.analytics = analyticsSdk.initializeAnalytics(app, {
          config: {
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
          },
        });
      } catch { next.analytics = null; next.analyticsSdk = null; }
    }
    if (performanceSdk && await performanceSdk.isSupported().catch(() => false)) {
      try { next.performance = performanceSdk.getPerformance(app); }
      catch { next.performance = null; }
    }
    services = next;
    applyEnabledState(hasWebDiagnosticsConsent());
    return Boolean(next.analytics || next.performance);
  })().catch(() => false).finally(() => { pending = null; });
  return pending;
}

export function setWebDiagnosticsConsent(enabled) {
  if (!isWeb()) return false;
  try {
    if (enabled) window.localStorage.setItem(WEB_DIAGNOSTICS_CONSENT_KEY, "yes");
    else window.localStorage.removeItem(WEB_DIAGNOSTICS_CONSENT_KEY);
  } catch { return false; }
  // A local preference is not an IFund account credential or a backend setting.
  void applyWebDiagnosticsConsent();
  return true;
}

export function installOptionalWebDiagnostics() {
  if (!isWeb() || installed) return;
  installed = true;
  window.addEventListener("storage", (event) => {
    if (event.key === WEB_DIAGNOSTICS_CONSENT_KEY || event.key === null) {
      void applyWebDiagnosticsConsent();
    }
  });
  // No network or Firebase code is loaded unless the visitor already opted in.
  if (hasWebDiagnosticsConsent()) void applyWebDiagnosticsConsent();
}
