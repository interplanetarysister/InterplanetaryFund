import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  Compass,
  House,
  LayoutDashboard,
  Menu,
  Moon,
  Sun,
  Users,
  X,
  CircleHelp,
  PlusCircle,
  Link2,
  UserRound,
  ShieldAlert,
} from "lucide-react";
import { Planet } from "./UI";
import { SLOGAN } from "../lib/brand";
import { navigationFor, isNavigationReady } from "../lib/migrationNavigation";
import { existingIndependentPagePaths } from "../lib/pageRoutes";

const icons = {
  "/": House,
  "/discover": Compass,
  "/dashboard": LayoutDashboard,
  "/community": Users,
  "/create": PlusCircle,
  "/mine": BookOpen,
  "/connections": Link2,
  "/login": UserRound,
  "/help": CircleHelp,
};
const labels = {
  "/": "Home",
  "/discover": "Discover",
  "/community": "Community",
  "/create": "New Campaign",
  "/mine": "My Campaigns",
  "/connections": "Connections",
  "/login": "Account",
};
export default function MigrationShell({ user, theme, setTheme, children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const closeRef = useRef(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const signedIn = Boolean(user);
  // app_metadata is assigned by trusted auth infrastructure, unlike editable
  // user_metadata. Only used to hide/show navigation, NOT as an API guard.
  const role = user?.app_metadata?.role ?? null;
  const sections = navigationFor({ signedIn, role });
  const page =
    labels[location.pathname] ||
    (location.pathname.startsWith("/campaign/")
      ? "Campaign"
      : "Interplanetary Fund");

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(menuRef.current?.querySelectorAll(
          "a[href],button:not([disabled])",
        ) ?? []),
      ];
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", keydown);
      menuButtonRef.current?.focus();
    };
  }, [open]);

  const links = (closeMenu) => (
    <nav className="ifund-primary-nav" aria-label="Main navigation">
      {sections.map((section) => (
        <div className="ifund-nav-section" key={section.label}>
          <p className="ifund-nav-section-label">{section.label}</p>
          {section.items.map((item) => {
            const Icon = icons[item.path] ?? BookOpen;
            const available = isNavigationReady(item);
            return available ? (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  "ifund-nav-entry" + (isActive ? " active" : "")
                }
                onClick={closeMenu}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
                {!existingIndependentPagePaths.has(item.path) && item.path !== "/mine" && (
                  <small title="Accessible page, backend migration not yet verified">Limited</small>
                )}
              </NavLink>
            ) : (
              <span
                key={item.path}
                className="ifund-nav-entry ifund-nav-pending"
                aria-disabled="true"
                title="This feature is not yet migrated"
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
                <small>Pending</small>
              </span>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const themeButton = (
    <button
      type="button"
      className="ifund-theme-toggle"
      onClick={toggleTheme}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
    >
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );

  return (
    <div className="ifund-shell">
      <aside
        className="ifund-sidebar ifund-sidebar-desktop"
        aria-label="Desktop navigation"
      >
        <Link className="ifund-logo" to="/">
          <Planet />
          <span>
            <strong>IFund</strong>
            <small>{SLOGAN}</small>
          </span>
        </Link>
        {links(() => {})}
        <div className="ifund-sidebar-bottom">
          {themeButton}
          <Link to="/login">{signedIn ? "Account" : "Sign in"}</Link>
        </div>
      </aside>

      <div className="ifund-shell-content">
        <header className="ifund-topbar">
          <button
            className="ifund-menu-button"
            ref={menuButtonRef}
            aria-controls="ifund-mobile-menu"
            aria-expanded={open}
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>
          <Link
            to="/"
            className="ifund-mobile-logo"
            aria-label="Interplanetary Fund home"
          >
            <Planet />
          </Link>
          <div className="ifund-current-page">
            <small>{signedIn ? "Your workspace" : "Explore"}</small>
            <strong>{page}</strong>
          </div>
          <div className="ifund-topbar-actions">
            <Link
              className="ifund-topbar-link"
              to={signedIn ? "/create" : "/login"}
            >
              {signedIn ? "New campaign" : "Sign in"}
            </Link>
            {themeButton}
          </div>
        </header>
        <div className="ifund-runtime-notice" role="status">
          <ShieldAlert size={15} aria-hidden="true" />
          Migration recovery build: original features marked Pending are not
          active. Payments are disabled.
        </div>
        <div className="ifund-stage" id="ifund-content">
          {children}
        </div>
        <footer className="ifund-footer">
          <strong>Interplanetary Fund</strong>
          <p>What if? · Build with care, give with purpose.</p>
          <small>
            Independent Supabase + Cloudflare recovery build. No payment
            processing enabled.
          </small>
          <nav aria-label="Legal information" className="ifund-legal-links">
            <Link to="/about">About</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </nav>
        </footer>
        <nav className="ifund-mobile-bottom" aria-label="Quick navigation">
          <NavLink end to="/">
            <House size={19} />
            Home
          </NavLink>
          <NavLink to="/discover">
            <Compass size={19} />
            Discover
          </NavLink>
          <NavLink to="/community">
            <Users size={19} />
            Community
          </NavLink>
          <NavLink to={signedIn ? "/create" : "/login"}>
            {signedIn ? <PlusCircle size={19} /> : <UserRound size={19} />}
            {signedIn ? "Create" : "Sign in"}
          </NavLink>
        </nav>
      </div>
      {open && (
        <div className="ifund-modal-layer">
          <button
            type="button"
            className="ifund-drawer-backdrop"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <aside
            id="ifund-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="IFund navigation"
            ref={menuRef}
            className="ifund-mobile-drawer"
          >
            <div className="ifund-drawer-heading">
              <strong>Explore IFund</strong>
              <button
                type="button"
                ref={closeRef}
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
              >
                <X size={22} />
              </button>
            </div>
            {links(() => setOpen(false))}
          </aside>
        </div>
      )}
    </div>
  );
}
