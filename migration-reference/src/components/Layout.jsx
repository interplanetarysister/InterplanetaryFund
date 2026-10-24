import React, { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Compass, PlusCircle, HeartHandshake, MessageSquare, Sparkles, Users, Building2, BarChart3, Server, Menu, X, Bell, User, CreditCard, Wallet, Link2, MailOpen, Heart, ChevronLeft, Globe2, Bot, Satellite } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import BrandLogo from "@/components/brand/BrandLogo";
import { SLOGAN, SLOGAN_LONG } from "@/components/brand/brand";
import useSwipeBack from "@/hooks/useSwipeBack";
import { AnimatePresence, motion } from "framer-motion";
import OfflineBanner from "@/components/mobile/OfflineBanner";
import { hapticTap } from "@/lib/haptics";

const PAGE_TITLES = {
  "/discover": "Discover", "/globe": "Global Globe", "/giving": "My Giving", "/communications": "Messages", "/agents": "AI Agents",
  "/inbox": "Inbox", "/following": "Following", "/mission": "Mission Control", "/ops": "Ops Center",
  "/connections": "Connections", "/community": "Community", "/institutions": "Institutions",
  "/analytics": "Command Center", "/subscriptions": "Plans", "/withdrawals": "Withdrawals",
  "/platform": "Platform", "/create": "New Campaign", "/profile": "Profile", "/notifications": "Notifications",
};
function pageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/campaign/")) return "Campaign";
  if (pathname.startsWith("/community/")) return "Community";
  if (pathname.startsWith("/institutions/")) return "Institution";
  return "Interplanetary Fund";
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/globe", label: "Global Globe", icon: Globe2 },
  { to: "/giving", label: "My Giving", icon: HeartHandshake },
  { to: "/communications", label: "Communications", icon: MessageSquare },
  { to: "/inbox", label: "Inbox", icon: MailOpen },
  { to: "/following", label: "Following", icon: Heart },
  { to: "/mission", label: "Mission Control", icon: Sparkles },
  { to: "/agents", label: "AI Agents", icon: Bot },
  { to: "/ops", label: "Ops Center", icon: Satellite },
  { to: "/connections", label: "Connections", icon: Link2 },
  { to: "/community", label: "Community", icon: Users },
  { to: "/institutions", label: "Institutions", icon: Building2 },
  { to: "/analytics", label: "Command Center", icon: BarChart3 },
  { to: "/subscriptions", label: "Plans", icon: CreditCard },
  { to: "/withdrawals", label: "Withdrawals", icon: Wallet },
  { to: "/platform", label: "Platform", icon: Server },
  { to: "/create", label: "New Campaign", icon: PlusCircle },
];

// One-handed mobile navigation. AI Assistant surfaces Mission Control — the
// platform's central intelligence hub — under its most user-friendly label.
const bottomNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/discover", label: "Campaigns", icon: Compass },
  { to: "/mission", label: "AI Assistant", icon: Sparkles },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Bottom-tab root views show the brand mark (no Back button); deep child
  // pages (e.g. a campaign detail) get the ChevronLeft back affordance.
  const TAB_ROOTS = ["/", "/discover", "/mission", "/notifications", "/profile"];
  const isRoot = TAB_ROOTS.includes(pathname);
  useSwipeBack(!isRoot);

  // Preserve each bottom tab's last sub-route so tapping a tab returns to the
  // last screen visited within that tab instead of resetting to its root.
  const tabStacks = useRef(Object.fromEntries(TAB_ROOTS.map((r) => [r, r])));
  // Which bottom tab each section of the app belongs to, so a campaign,
  // community, or institution page highlights its own tab instead of Dashboard.
  const TAB_SECTIONS = {
    "/discover": ["/discover", "/campaign", "/globe", "/create"],
    "/mission": ["/mission", "/agents", "/ops", "/analytics", "/community", "/institutions", "/connections"],
    "/notifications": ["/notifications", "/inbox", "/communications"],
    "/profile": ["/profile", "/giving", "/following", "/subscriptions", "/withdrawals"],
  };
  const owningRoot = (p) => {
    if (p === "/") return "/";
    const hit = Object.entries(TAB_SECTIONS).find(([, prefixes]) =>
      prefixes.some((pre) => p === pre || p.startsWith(pre + "/"))
    );
    return hit ? hit[0] : null;
  };
  const activeTab = useRef(owningRoot(pathname) || "/");
  useEffect(() => {
    const root = owningRoot(pathname);
    if (root) activeTab.current = root;
    tabStacks.current[activeTab.current] = pathname;
  }, [pathname]);
  const goTab = (root) => {
    hapticTap();
    // Re-tapping the active tab resets that tab's stack back to its root.
    if (activeTab.current === root) {
      tabStacks.current[root] = root;
      activeTab.current = root;
      navigate(root);
      return;
    }
    activeTab.current = root;
    navigate(tabStacks.current[root] || root);
  };
  const isTabActive = (root) =>
    root === "/"
      ? pathname === "/" || activeTab.current === "/"
      : pathname === root || pathname.startsWith(root + "/") || activeTab.current === root;

  const nav = (
    <nav className="flex flex-col gap-1 px-3">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
          `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
            isActive ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
          }`
          }
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col deep-space py-6 z-40">
        <div className="px-5 mb-8">
          <div className="flex items-start justify-between gap-2">
            <Link to="/profile" className="min-w-0" aria-label="Account settings">
              <BrandLogo size="sm" nameClassName="text-slate-100 text-[15px] leading-tight" />
            </Link>
            <NotificationBell />
          </div>
          <p className="mt-3 font-display text-lg brand-gradient-text">{SLOGAN}</p>
        </div>
        {nav}
        <p className="mt-auto px-6 text-[11px] leading-relaxed text-slate-500">{SLOGAN_LONG}</p>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 deep-space px-3 py-3 pt-safe">
        {isRoot ? (
          <Link to="/profile" className="min-w-0" aria-label="Account settings">
            <BrandLogo size="sm" nameClassName="text-slate-100 text-[15px] truncate" />
          </Link>
        ) : (
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={() => navigate(-1)} aria-label="Back" className="text-stone-300 p-2 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:text-white transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="font-display text-slate-100 text-lg truncate">{pageTitle(pathname)}</span>
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationBell />
          <button onClick={() => setOpen(!open)} className="text-stone-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>
      <OfflineBanner />
      {open && (
        <>
          <div className="md:hidden fixed inset-0 top-14 z-30 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="md:hidden fixed inset-x-0 top-14 z-40 deep-space pb-4 pt-2 shadow-xl">{nav}</div>
        </>
      )}

      {/* Mobile bottom navigation — one-handed access to core surfaces */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 deep-space border-t border-white/10 flex pb-safe">
        {bottomNavItems.map(({ to, label, icon: Icon }) => {
          const active = isTabActive(to);
          return (
            <button
              key={to}
              onClick={() => goTab(to)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] text-[10px] font-medium transition-colors ${
                active ? "text-cyan-400" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* overflow-x-clip (not overflow-hidden) keeps the page-transition slide
          from causing sideways scroll without turning main into a nested,
          non-scrollable container — the cause of stuck vertical scrolling in
          the Android WebView. */}
      <main className="md:pl-60 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 overflow-x-clip">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}