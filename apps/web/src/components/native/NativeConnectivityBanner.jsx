import { useEffect, useState } from "react";
import { isNativeBundle } from "@/lib/nativeApi";

// Bundled apps can render local HTML while the live IFund API is unreachable.
// Show an explicit, non-financial status rather than silently suggesting that
// campaign changes, messages or donations have been synced.
export default function NativeConnectivityBanner() {
  const native = isNativeBundle();
  const [status, setStatus] = useState(() =>
    native && typeof navigator !== "undefined" && navigator.onLine === false
      ? "offline" : "unknown"
  );
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!native) return;
    const offline = () => setStatus("offline");
    // Browser "online" only means network interface available; it does not
    // establish that Supabase, Cloudflare or the live ledger are reachable.
    const online = () => setStatus("unknown");
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [native]);

  async function checkConnection() {
    if (checking) return;
    setChecking(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      // An SPA fallback can return HTML with HTTP 200 even when the API
      // Worker is missing; require the actual canonical health contract.
      const payload = response.ok ? await response.json().catch(() => null) : null;
      const healthy = response.ok && payload?.status === "ok" &&
        payload?.service === "ifund-migration-api";
      setStatus(healthy ? "unknown" : "unavailable");
    } catch {
      setStatus("unavailable");
    } finally {
      clearTimeout(timeout);
      setChecking(false);
    }
  }

  if (!native || !["offline", "unavailable"].includes(status)) return null;
  return (
    <aside role="status" aria-live="polite" aria-label="IFund live connection"
      className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-3 border-b border-amber-600/40 bg-slate-950 px-4 py-3 text-center text-sm text-white">
      <p className="max-w-lg">
        {status === "offline"
          ? "Your device is offline. Live campaign, account, and giving records are unavailable."
          : "The live IFund service could not be reached. Changes and payments cannot be confirmed."}
      </p>
      <button type="button" onClick={checkConnection} disabled={checking}
        className="min-h-11 rounded-lg border border-white/70 px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60">
        {checking ? "Checking…" : "Check connection"}
      </button>
    </aside>
  );
}
