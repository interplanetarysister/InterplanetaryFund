/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { TermsAcceptance } from "./components/TermsAcceptance";
import ErrorBoundary from "./components/ErrorBoundary";
import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// Lazy load pages
const Explore = lazy(() => import("./pages/Explore"));
const FacebookGroups = lazy(() => import("./pages/FacebookGroups"));
const Admin = lazy(() => import("./pages/Admin"));
const GlobePage = lazy(() => import("./pages/Globe"));
const UserLogin = lazy(() => import("./pages/UserLogin"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const CampaignEditor = lazy(() => import("./pages/CampaignEditor"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex gap-2">
        <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" />
        <span className="w-2 h-2 rounded-full bg-ifaccent animate-pulse-glow" style={{ animationDelay: "0.2s" }} />
        <span className="w-2 h-2 rounded-full bg-ifcyan animate-pulse-glow" style={{ animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}

type View = "explore" | "facebook" | "globe" | "admin" | "login" | "dashboard" | "editor" | "detail";

export default function App() {
  const [view, setView] = useState<View>("explore");
  const [tapCount, setTapCount] = useState(0);
  const [showPinGate, setShowPinGate] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [adminUser, setAdminUser] = useState<{name: string; role: string; permissions: string[]} | null>(null);

  // User auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [editCampaignId, setEditCampaignId] = useState<string | null>(null);
  const [viewCampaignId, setViewCampaignId] = useState<string | null>(null);

  // Restore user session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("if_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUserId(u.userId);
        setUserName(u.name);
      } catch {}
    }
  }, []);

  const pinCheck = useQuery(
    api.adminUsers.authenticateAdmin,
    showPinGate && pinInput.length >= 4 ? { pin: pinInput } : "skip"
  );

  const navItems = useMemo<{ id: View; label: string; icon: string }[]>(
    () => [
      { id: "explore", label: "Launch Pads", icon: "\u2705" },
      { id: "globe", label: "Earth", icon: "\u{1F30D}" },
      { id: "facebook", label: "Sectors", icon: "f" },
      { id: "dashboard", label: "My Missions", icon: "\u{1F680}" },
    ],
    []
  );

  const handleLogoTap = useCallback(() => {
    const newCount = tapCount + 1;
    if (newCount >= 5) {
      if (authed) setView("admin");
      else setShowPinGate(true);
      setTapCount(0);
    } else {
      setTapCount(newCount);
    }
  }, [tapCount, authed]);

  const handlePinSubmit = useCallback(() => {
    if (pinCheck === undefined) return;
    if (pinCheck?.valid === true) {
      setAuthed(true);
      setAdminUser({
        name: pinCheck.name || "Admin",
        role: pinCheck.role || "admin",
        permissions: pinCheck.permissions || [],
      });
      setView("admin");
      setShowPinGate(false);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  }, [pinCheck]);

  useEffect(() => {
    if (pinCheck?.valid === true && showPinGate) {
      setAuthed(true);
      setAdminUser({
        name: pinCheck.name || "Admin",
        role: pinCheck.role || "admin",
        permissions: pinCheck.permissions || [],
      });
      setView("admin");
      setShowPinGate(false);
      setPinInput("");
      setPinError(false);
    }
  }, [pinCheck, showPinGate]);

  const exitAdmin = useCallback(() => {
    setView("explore");
    setAuthed(false);
    setAdminUser(null);
  }, []);

  const closePinGate = useCallback(() => {
    setShowPinGate(false);
    setPinInput("");
    setPinError(false);
  }, []);

  const handleUserLogin = useCallback((uid: string, name: string) => {
    setUserId(uid);
    setUserName(name);
    localStorage.setItem("if_user", JSON.stringify({ userId: uid, name }));
    setView("dashboard");
  }, []);

  const handleUserLogout = useCallback(() => {
    setUserId(null);
    setUserName("");
    localStorage.removeItem("if_user");
    setView("explore");
  }, []);

  const handleEditCampaign = useCallback((campaignId: string) => {
    setEditCampaignId(campaignId);
    setView("editor");
  }, []);

  const handleViewCampaign = useCallback((campaignId: string) => {
    setViewCampaignId(campaignId);
    setView("detail");
  }, []);

  return (
    <TermsAcceptance>
    <div className="min-h-screen bg-ifdark flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-ifdark/95 backdrop-blur border-b border-ifborder">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={handleLogoTap} className="w-9 h-9 rounded-xl bg-ifaccent flex items-center justify-center text-ifwhite font-bold text-sm shadow-glow-purple">IF</button>
            <div>
              <h1 className="text-sm font-bold text-iftext">Interplanetary Fund</h1>
              <p className="text-[10px] text-ifmuted">
                {view === "admin" ? `Cockpit — ${adminUser?.name || ""}` :
                 view === "facebook" ? "Outreach Sectors" :
                 view === "globe" ? "Global Campaign Locator" :
                 view === "dashboard" ? "My Missions" :
                 view === "editor" ? "Campaign Editor" :
                 view === "detail" ? "Campaign Details" :
                 view === "login" ? "Pilot Sign In" :
                 "Fuel a cause today"}
              </p>
            </div>
          </div>
          {view === "admin" ? (
            <button onClick={exitAdmin} className="text-[10px] text-ifmuted px-3 py-1 rounded-full border border-ifborder">Exit Cockpit</button>
          ) : view === "editor" ? (
            <button onClick={() => setView("dashboard")} className="text-[10px] text-ifmuted px-3 py-1 rounded-full border border-ifborder">Back</button>
          ) : view === "detail" ? (
            <button onClick={() => setView("explore")} className="text-[10px] text-ifmuted px-3 py-1 rounded-full border border-ifborder">Back</button>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-ifgreen animate-pulse" />
              <span className="text-[10px] text-ifmuted">Live</span>
            </div>
          )}
        </div>
      </header>

      {/* PIN Gate Modal */}
      {showPinGate && (
        <div className="fixed inset-0 z-50 bg-ifdark/95 backdrop-blur flex items-center justify-center">
          <div className="max-w-xs w-full px-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-ifaccent flex items-center justify-center text-ifwhite font-bold text-xl mx-auto mb-3 shadow-glow-purple">🔒</div>
              <h2 className="text-lg font-bold text-iftext">Cockpit Access</h2>
              <p className="text-xs text-ifmuted mt-1">Enter your PIN to continue</p>
            </div>
            <input type="password" inputMode="numeric" maxLength={8} placeholder="••••" value={pinInput} onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(false); }} onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()} className="input-field text-center text-2xl tracking-[0.5em] font-bold" autoFocus />
            {pinError && <p className="text-xs text-ifred text-center mt-2">Incorrect PIN. Try again.</p>}
            <button onClick={handlePinSubmit} disabled={pinInput.length < 4} className="btn-primary mt-4">Unlock</button>
            <button onClick={closePinGate} className="w-full text-xs text-ifmuted text-center mt-3 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className={`max-w-md mx-auto px-4 py-4 pb-20 min-h-screen flex-1 ${view === "globe" ? "p-0 max-w-none" : ""}`}>
        <Suspense fallback={<PageLoader />}>
          {view === "explore" && <Explore onViewCampaign={handleViewCampaign} />}
          {view === "globe" && <GlobePage />}
          {view === "facebook" && <FacebookGroups />}
          {view === "admin" && <ErrorBoundary><Admin adminUser={adminUser} /></ErrorBoundary>}
          {view === "login" && <UserLogin onLogin={handleUserLogin} />}
          {view === "dashboard" && userId && (
            <UserDashboard
              userId={userId}
              userName={userName}
              onLogout={handleUserLogout}
              onEditCampaign={handleEditCampaign}
            />
          )}
          {view === "dashboard" && !userId && <UserLogin onLogin={handleUserLogin} />}
          {view === "editor" && userId && editCampaignId && (
            <CampaignEditor
              campaignId={editCampaignId}
              userId={userId}
              onBack={() => setView("dashboard")}
            />
          )}
          {view === "detail" && viewCampaignId && (
            <CampaignDetail
              campaignId={viewCampaignId}
              userId={userId}
              onBack={() => setView("explore")}
              onLogin={() => setView("login")}
            />
          )}
        </Suspense>
      </main>

      {/* Bottom Navigation */}
      {view !== "admin" && !showPinGate && view !== "login" && view !== "detail" && (
        <nav className="sticky bottom-0 z-40 bg-ifdark/95 backdrop-blur border-t border-ifborder">
          <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "dashboard" && !userId) {
                    setView("login");
                  } else {
                    setView(item.id);
                  }
                }}
                className={`nav-item ${view === item.id ? "nav-item-active" : "nav-item-inactive"}`}
              >
                <span className={`text-lg ${item.id === "facebook" ? "font-bold" : ""}`}>{item.icon}</span>
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
    </TermsAcceptance>
  );
}
