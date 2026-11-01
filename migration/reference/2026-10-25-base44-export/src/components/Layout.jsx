import React, { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Compass, PlusCircle, HeartHandshake, MessageSquare, Sparkles, Users, Building2, BarChart3, Server, Menu, X, User, CreditCard, Wallet, Link2, MailOpen, Heart, ChevronLeft, Globe2, Bot, Satellite, Plug, Radio, BookOpen, House, CircleHelp, Leaf } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import BrandLogo from "@/components/brand/BrandLogo";
import { SLOGAN } from "@/components/brand/brand";
import useSwipeBack from "@/hooks/useSwipeBack";
import { AnimatePresence, motion } from "framer-motion";
import OfflineBanner from "@/components/mobile/OfflineBanner";
import LegalFooter from "@/components/LegalFooter";
import ErrorBoundary from "@/components/ErrorBoundary";
import BackToTop from "@/components/BackToTop";
import QuickActions from "@/components/QuickActions";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuth } from "@/lib/AuthContext";
import { navigationBackFallback, canReturnWithinApp } from "@/lib/navigation";
import { hasPlanLevel } from "@/lib/subscriptionEntitlements";
import { helpPathForLocation } from "@/lib/helpCenter";
import { LifeBuoy, ArrowUpRight, Sun, Moon } from "lucide-react";

const PAGE_TITLES = {
  "/dashboard": "Overview", "/help": "Help Center", "/admin/help": "Help Center Editor", "/devices": "Connected Devices",
  "/discover": "Discover", "/globe": "Global Globe", "/giving": "My Giving", "/communications": "Messages", "/agents": "AI Team",
  "/inbox": "Inbox", "/following": "Following", "/mission": "Mission Control", "/ai-images": "AI Image Studio", "/ops": "Ops Center",
  "/connections": "Connections", "/community": "Community", "/institutions": "Institutions",
  "/analytics": "Command Center", "/subscriptions": "Plans", "/withdrawals": "Withdrawals",
  "/admin/founding-members": "Founding Members", "/platform": "Platform", "/create": "New Campaign", "/profile": "Profile", "/notifications": "Notifications",
  "/social": "Social", "/blogs": "Stories & Blogs", "/my-blog": "My Blog Studio", "/donors": "Supporters", "/ledger": "Financial Ledger", "/connect": "AI Connections", "/admin/external-accounts": "Connections", "/admin/integrations": "Admin Integrations", "/admin/audit": "Audit Log", "/admin/sustainability": "Planet Impact",
};
function pageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/campaign/")) return "Campaign";
  if (pathname.startsWith("/u/")) return "Member Profile";
  if (pathname.startsWith("/blogs/")) return "IFund Story";
  if (pathname.startsWith("/help/")) return "Help Article";
  if (pathname.startsWith("/community/")) return "Community";
  if (pathname.startsWith("/institutions/")) return "Institution";
  return "Interplanetary Fund";
}

// Order follows the tasks people do: explore, create, connect, then manage.
// Keep a single destination per section and preserve existing authorization gates.
const navSections = [
  {
    label: "Explore",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/discover", label: "Discover", icon: Compass },
      { to: "/globe", label: "Global Globe", icon: Globe2 },
    ],
  },
  {
    label: "Campaigns & Giving",
    items: [
      { to: "/create", label: "New Campaign", icon: PlusCircle },
      { to: "/donors", label: "Supporters", icon: Users },
      { to: "/giving", label: "My Giving", icon: HeartHandshake },
      { to: "/following", label: "Following", icon: Heart },
      { to: "/withdrawals", label: "Withdrawals", icon: Wallet },
      { to: "/ledger", label: "Financial Ledger", icon: BookOpen },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/social", label: "IFund Social", icon: Radio },
      { to: "/community", label: "Community", icon: Users },
      { to: "/blogs", label: "Stories & Blogs", icon: BookOpen },
      { to: "/my-blog", label: "My Blog", icon: BookOpen },
      { to: "/institutions", label: "Institutions", icon: Building2 },
      { to: "/communications", label: "Messages", icon: MessageSquare },
      { to: "/inbox", label: "Inbox", icon: MailOpen },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { to: "/agents", label: "AI Team", icon: Bot },
      { to: "/mission", label: "Mission Control", icon: Sparkles },
      { to: "/ai-images", label: "AI Image Studio", icon: Sparkles },
    ],
  },
  {
    label: "Account & Help",
    items: [
      { to: "/profile", label: "Profile", icon: User },
      { to: "/connections", label: "Connections", icon: Link2 },
      { to: "/subscriptions", label: "Plans", icon: CreditCard },
      { to: "/help", label: "Help Center", icon: CircleHelp },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/ops", label: "Ops Center", icon: Satellite },
      { to: "/analytics", label: "Command Center", icon: BarChart3 },
      { to: "/platform", label: "Platform", icon: Server },
      { to: "/admin/integrations", label: "Admin Integrations", icon: Plug },
      { to: "/admin/audit", label: "Audit Log", icon: Server },
      { to: "/admin/sustainability", label: "Planet Impact", icon: Leaf },
      { to: "/admin/help", label: "Help Center Editor", icon: BookOpen },
      { to: "/admin/founding-members", label: "Founding Members", icon: Users },
    ],
  },
];

// Flat list kept for backward-compatible lookups (e.g. mobile menu).
const navItems = navSections.flatMap((s) => s.items);

const publicNavItems = [
  { to: "/", label: "Home", icon: House },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/community", label: "Community", icon: Users },
  { to: "/social", label: "IFund Social", icon: Radio },
  { to: "/globe", label: "Global Globe", icon: Globe2 },
  { to: "/blogs", label: "Stories & Blogs", icon: BookOpen },
  { to: "/help", label: "Help Center", icon: CircleHelp },
];



export default function Layout() {
  const [open, setOpen] = useState(false);
  const drawerCloseRef = useRef(null);
  const [darkTheme, setDarkTheme] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    try { localStorage.setItem("ifund-theme", next ? "dark" : "light"); } catch {}
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    setDarkTheme(next);
    window.dispatchEvent(new Event("ifund-theme-changed"));
  };
  useEffect(() => {
    const sync = () => setDarkTheme(document.documentElement.classList.contains("dark"));
    sync();
    window.addEventListener("ifund-theme-changed", sync);
    return () => window.removeEventListener("ifund-theme-changed", sync);
  }, []);
  const { user: currentUser, isAuthenticated } = useAuth();
  const user = isAuthenticated ? currentUser : null;
  const isAdmin = user?.role === "admin";
  const hasAiAgents = hasPlanLevel(user, 1);
  const { pathname } = useLocation();
  const title = pageTitle(pathname);
  // Keep each area recognizable beyond the sidebar, including nested pages.
  const PageIcon = navItems.find((item) => item.to === pathname)?.icon
    || publicNavItems.find((item) => item.to === pathname)?.icon
    || (pathname.startsWith("/campaign/") ? HeartHandshake
      : pathname.startsWith("/community/") ? Users
      : pathname.startsWith("/blogs/") ? BookOpen
      : pathname.startsWith("/help/") ? CircleHelp : Compass);
  const section = pathname.startsWith("/admin/") ? "Administration"
    : ["/discover", "/campaign", "/community", "/help"].some(v => pathname.startsWith(v)) ? "Explore"
    : "Your workspace";
  const navigate = useNavigate();
  const isRoot = ["/", "/dashboard", "/discover", "/social", "/inbox",
    "/profile", "/community", "/help", "/globe"].includes(pathname);
  const goBack = () => {
    if (canReturnWithinApp(window.history.state)) navigate(-1);
    else navigate(navigationBackFallback(pathname, !!user), { replace: true });
  };
  useSwipeBack(!isRoot, goBack);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => drawerCloseRef.current?.focus());
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key !== "Tab") return;
      const drawer = document.getElementById("mobile-menu");
      const items = Array.from(drawer?.querySelectorAll('a[href],button:not([disabled])') || []);
      if (!items.length) return;
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0]?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    // Keep scrolling and keyboard focus inside the modal drawer.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  const nav = (
    <nav aria-label="Main navigation" className="ifund-sidebar-nav flex min-h-0 flex-1 flex-col gap-3 px-2 overflow-y-auto overscroll-contain scrollbar-hide pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {!user ? (
        <div>
          <p className="ifund-nav-section-title px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/90">Explore</p>
          <div className="flex flex-col gap-0.5">
            {publicNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)} className={({ isActive }) => `ifund-nav-link flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${isActive ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"}`}>
                <span className="ifund-nav-icon"><Icon className="w-5 h-5 shrink-0" strokeWidth={1.85} /></span><span className="ifund-nav-label">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ) : navSections.filter(section => isAdmin || section.label !== "Administration").map((section) => (
        <div key={section.label} data-ifund-nav-group={section.label}>
          <p className="ifund-nav-section-title px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400/90">{section.label}</p>
          <div className="flex flex-col gap-0.5">
            {section.items.filter(({ to }) => {
              if (to === "/agents") return hasAiAgents;
              const adminOnly = ["/analytics", "/connect", "/ops", "/platform"].includes(to) || to.startsWith("/admin/");
              return isAdmin || !adminOnly;
            }).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                `ifund-nav-link flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                }`
                }
              >
                <span className="ifund-nav-icon"><Icon className="w-5 h-5 shrink-0" strokeWidth={1.85} /></span>
                <span className="ifund-nav-label">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="ifund-shell h-dvh w-full min-w-0 overflow-hidden bg-background text-foreground flex flex-col md:flex-row">
      <aside className="ifund-sidebar ifund-desktop-sidebar hidden md:flex relative self-stretch shrink-0 w-max flex-col py-6 z-40">
        <div className="px-3 mb-5">
          <div className="flex items-center justify-between gap-2">
            <Link to={user ? "/dashboard" : "/"} className="min-w-0 flex items-center gap-2 cursor-pointer" aria-label={user ? "Go to dashboard" : "Go home"}>
              <BrandLogo size="sm" showName={false} />
              <span className="font-display text-sm font-bold text-foreground">IFund</span>
            </Link>
            <button type="button" onClick={toggleTheme} className="ifund-sidebar-theme rounded-xl p-2" aria-label={darkTheme ? "Switch to light theme" : "Switch to dark theme"} title={darkTheme ? "Light theme" : "Dark theme"}>{darkTheme ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          </div>
          <p className="mt-3 font-display text-base brand-gradient-text">{SLOGAN}</p>
        </div>
        {nav}
      </aside>

      <header className="ifund-mobile-header md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 px-3 py-3 pt-safe">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-menu"
                  className="ifund-header-action p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Open navigation"><Menu className="w-5 h-5" /></button>
          {!isRoot && (
            <button onClick={goBack} aria-label="Back" className="ifund-header-action p-2 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <Link to={user ? "/dashboard" : "/"} className="min-w-0 cursor-pointer" aria-label={user ? "Go to dashboard" : "Go home"}>
            <BrandLogo size="sm" showName={isRoot} nameClassName="ifund-brand-title text-[15px] truncate" />
          </Link>
          {!isRoot && <span className="font-display ifund-mobile-title text-lg truncate">{pageTitle(pathname)}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={toggleTheme} className="ifund-header-action min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={darkTheme ? "Switch to light theme" : "Switch to dark theme"}>{darkTheme ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          {user && <NotificationBell />}
        </div>
      </header>
      <OfflineBanner />
      {open && (
        <>
          <div className="ifund-drawer-backdrop md:hidden fixed inset-0 z-[60] bg-slate-950/25 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="mobile-menu" role="dialog" aria-modal="true" aria-label="IFund navigation"
               className="ifund-sidebar ifund-drawer md:hidden fixed inset-y-0 left-0 z-[70] pt-safe shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-current/10">
              <span className="font-display text-base font-bold">Explore IFund</span>
              <button type="button" ref={drawerCloseRef} onClick={() => setOpen(false)} className="ifund-sidebar-theme rounded-xl p-3" aria-label="Close navigation"><X className="w-5 h-5" /></button>
            </div>
            {nav}
          </div>
        </>
      )}

      <MobileBottomNav user={user} onNavigate={() => setOpen(false)} />

      <main data-page-scroll className="ifund-experience ifund-stage flex-1 min-h-0 w-full min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background text-foreground">
        <div className="ifund-workspace-bar hidden md:flex sticky top-0 z-20 items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <span className="ifund-page-icon" aria-hidden="true"><PageIcon className="w-5 h-5" strokeWidth={1.85} /></span>
            <div className="min-w-0">
              <p className="ifund-workspace-kicker">{section}</p>
              <p className="ifund-workspace-title truncate">{title}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to={helpPathForLocation(pathname)} className="ifund-workspace-utility inline-flex min-h-10 items-center gap-2 px-3 text-xs font-semibold" aria-label="Visit IFund Help Center">
              <LifeBuoy className="h-4 w-4" />
              <span className="hidden sm:inline">Help Center</span>
            </Link>
            {user && (
              <Link to="/create" className="hidden lg:inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800" aria-label="Create a campaign">
                New campaign <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full min-w-0 max-w-full overflow-x-hidden"
          >
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
        <QuickActions user={user} />
        <BackToTop />
        <div><LegalFooter /></div>
      </main>
    </div>
  );
}