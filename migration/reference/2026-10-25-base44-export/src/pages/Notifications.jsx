import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Bell, Loader2, CheckCheck, ChevronRight } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import IndependentAdminMail from "@/components/inbox/IndependentAdminMail";
import { Button } from "@/components/ui/button";
import { contextualNotificationDestination } from "@/lib/actionDestinations";
import { isAndroidApp, getCrashReporting, setCrashReporting, hasLocalPushRegistration, enableAndroidPush, disableAndroidPush } from "@/lib/androidFirebaseFeatures";
import { hasWebDiagnosticsConsent, setWebDiagnosticsConsent } from "@/lib/firebaseWebFeatures";

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const requestGeneration = useRef(0);
  const mountedRef = useRef(true);
  const [pushEnabled, setPushEnabled] = useState(() => hasLocalPushRegistration());
  const [crashEnabled, setCrashEnabled] = useState(false);
  const [nativeBusy, setNativeBusy] = useState("");
  const [nativeError, setNativeError] = useState("");
  const [webDiagnosticsAllowed, setWebDiagnosticsAllowed] = useState(() => hasWebDiagnosticsConsent());
  const [webDiagnosticsError, setWebDiagnosticsError] = useState("");

  const load = async () => {
    const generation = ++requestGeneration.current;
    try {
      const me = await base44.auth.me();
      if (!me?.id) throw new Error("Malformed auth response");
      const mine = await base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50);
      if (!Array.isArray(mine)) throw new Error("Malformed notification response");
      if (!mountedRef.current || generation !== requestGeneration.current) return false;
      setUser(me);
      setItems(mine);
      setError("");
      return true;
    } catch (e) {
      console.error("Notifications load failed:", e?.name || "UnknownError");
      if (mountedRef.current && generation === requestGeneration.current) {
        setItems([]);
        setError("We couldn't load your notifications. Please try again.");
      }
      return false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      requestGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!isAndroidApp) return;
    getCrashReporting().then((enabled) => { if (mountedRef.current) setCrashEnabled(enabled); })
      .catch(() => { /* Crash reporting remains disabled by default. */ });
  }, []);

  const setPushPreference = async () => {
    if (nativeBusy) return;
    setNativeBusy("push"); setNativeError("");
    try {
      if (pushEnabled) {
        await disableAndroidPush();
        setPushEnabled(false);
      } else {
        await enableAndroidPush();
        setPushEnabled(true);
      }
    } catch {
      setNativeError("Device notifications could not be updated. Please try again.");
    } finally { setNativeBusy(""); }
  };

  const setCrashPreference = async () => {
    if (nativeBusy) return;
    setNativeBusy("crash"); setNativeError("");
    try {
      const next = !crashEnabled;
      await setCrashReporting(next);
      setCrashEnabled(next);
    } catch {
      setNativeError("Crash report preference could not be saved.");
    } finally { setNativeBusy(""); }
  };

  const toggleWebDiagnostics = () => {
    const next = !webDiagnosticsAllowed;
    if (!setWebDiagnosticsConsent(next)) {
      setWebDiagnosticsError("Could not save this browser preference.");
      return;
    }
    setWebDiagnosticsAllowed(next);
    setWebDiagnosticsError("");
  };

  const markAllRead = async () => {
    if (!user) return;
    try {
      await base44.entities.Notification.updateMany({ user_id: user.id, read: false }, { $set: { read: true } });
      await load();
    } catch (e) {
      console.error("Mark notifications read failed:", e?.name || "UnknownError");
      if (mountedRef.current) setError("We couldn't update your notifications. Please try again.");
    }
  };

  const openItem = async (n) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      await base44.entities.Notification.update(n.id, { read: true }).catch((e) => {
        console.error("Notification update failed:", e?.name || "UnknownError");
        if (mountedRef.current) setError("We couldn't update this notification. Please try again.");
      });
    }
    const destination = contextualNotificationDestination(n);
    if (destination) navigate(destination);
  };

  if (!items) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading notifications</span></div>;
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <PullToRefresh onRefresh={load} className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-end justify-between mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-3xl text-stone-900">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </span>
          Notifications
        </h1>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="rounded-xl">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error} <button type="button" onClick={() => { setItems(null); load(); }} className="font-semibold underline">Retry</button></div>}

      {isAndroidApp && (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-card p-5" aria-label="Android device preferences">
          <h2 className="font-semibold text-foreground">Android device preferences</h2>
          <p className="text-sm text-muted-foreground mt-1">Your existing IFund account stays on Base44. Firebase never becomes your login provider.</p>
          {nativeError && <p className="mt-3 text-sm text-destructive" role="alert">{nativeError}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-medium">Device push notifications</p><p className="text-xs text-muted-foreground">Requires permission and IFund's notification delivery service.</p></div>
            <Button variant="outline" disabled={!!nativeBusy} onClick={setPushPreference}>
              {nativeBusy === "push" ? "Saving…" : pushEnabled ? "Turn off" : "Allow"}
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-medium">Share crash reports</p><p className="text-xs text-muted-foreground">Optional technical diagnostics; off until you choose to share.</p></div>
            <Button variant="outline" disabled={!!nativeBusy} onClick={setCrashPreference}>
              {nativeBusy === "crash" ? "Saving…" : crashEnabled ? "Turn off" : "Turn on"}
            </Button>
          </div>
        </section>
      )}

      {!isAndroidApp && (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Optional web diagnostics">
          <h2 className="font-semibold text-slate-900">Optional web diagnostics</h2>
          <p className="mt-1 text-sm text-slate-700">Help us find slow pages and understand general site use. This shares technical website activity with Google Firebase, including page and network performance information. It never replaces your IFund login or payment records. Off unless you allow it.</p>
          {webDiagnosticsError && <p className="mt-2 text-sm text-red-700" role="alert">{webDiagnosticsError}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-800">Analytics and speed monitoring: {webDiagnosticsAllowed ? "Allowed" : "Off"}</p>
            <Button type="button" variant="outline" onClick={toggleWebDiagnostics} aria-pressed={webDiagnosticsAllowed}>
              {webDiagnosticsAllowed ? "Turn off" : "Allow"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-600">This browser-only choice can be changed at any time. It does not enable advertising personalization or collect custom donation details.</p>
        </section>
      )}

      {user?.role === "admin" && <IndependentAdminMail />}

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
          <p className="font-display text-lg text-stone-700 mb-1">You're all caught up</p>
          <p className="text-sm text-stone-500">Notifications about donations, milestones, and AI alerts appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const destination = contextualNotificationDestination(n);
            const clickable = !!destination;
            const Card = clickable ? "button" : "div";
            return (
              <Card
                key={n.id}
                {...(clickable ? { onClick: () => openItem(n) } : {})}
                className={`w-full text-left flex gap-3 rounded-xl border p-4 transition-colors ${n.read ? "bg-white border-slate-200" : "bg-primary/10 border-primary/20"} ${clickable ? "hover:border-primary/40 cursor-pointer" : ""}`}
              >
                {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                <div className={`flex-1 min-w-0 ${n.read ? "pl-2" : ""}`}>
                  <p className="font-medium text-stone-800 text-sm">{n.title}</p>
                  {n.body && <p className="text-sm text-stone-500">{n.body}</p>}
                </div>
                {clickable && (
                  <span className="text-xs text-primary font-semibold shrink-0 self-center flex items-center gap-1">
                    Open action <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PullToRefresh>
  );
}