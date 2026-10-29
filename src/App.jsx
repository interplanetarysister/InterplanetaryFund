import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { db, configured } from "./lib/supabase";
import { platforms } from "./lib/platforms";
import { SLOGAN } from "./lib/brand";
import { Planet, Loading } from "./components/UI";
import Feed from "./pages/Feed";
import Dashboard from "./pages/Dashboard";
import Discover from "./pages/Discover";
import Detail from "./pages/CampaignDetail";
import Editor from "./pages/CampaignEditor";
import MyCampaigns from "./pages/MyCampaigns";
import Auth from "./pages/Auth";
import Connections from "./pages/Connections";
import Community from "./pages/Community";
import Profile from "./pages/Profile";
import MyGiving from "./pages/MyGiving";
import FollowedCampaigns from "./pages/FollowedCampaigns";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Help from "./pages/Help";
import HelpArticle from "./pages/HelpArticle";
import Inbox from "./pages/Inbox";
import Notifications from "./pages/Notifications";
import Blogs from "./pages/Blogs";
import MyBlog from "./pages/MyBlog";
import BlogArticle from "./pages/BlogArticle";
function App() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(undefined);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("ifund-theme") === "light" ? "light" : "dark"; }
    catch { return "dark"; }
  });
  useEffect(() => {
    if (!db) {
      setUser(null);
      return;
    }
    db.auth.getUser().then(({ data }) => setUser(data.user || null));
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) =>
      setUser(session?.user || null),
    );
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("ifund-theme", theme); } catch { /* blocked storage */ }
  }, [theme]);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [menuOpen]);
  return (
    <div className="app">
      <header>
        <div className="brand">
          <Link to="/" aria-label="Interplanetary Fund home">
            <Planet />
          </Link>
          <div>
            <strong>Interplanetary Fund</strong>
            <small>{SLOGAN}</small>
          </div>
        </div>
        <button type="button" className="menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-controls="ifund-side-menu" aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}>
          ☰ Menu
        </button>
        <nav className="header-links" aria-label="Quick navigation">
          <NavLink end to="/">
            Home
          </NavLink>
          <NavLink to="/discover">Explore</NavLink>
          <NavLink to="/social">Community</NavLink>
          <NavLink to="/connections">Connections</NavLink>
          <NavLink to="/mine">My campaigns</NavLink>
        </nav>
        <div className="actions top-actions">
          <button
            aria-label="Toggle theme"
            title="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            ◐
          </button>
          <Link to={user ? "/profile" : "/login"}>{user ? "Account" : "Sign in"}</Link>
        </div>
      </header>
      {menuOpen && <button type="button" className="side-menu-backdrop"
        aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside id="ifund-side-menu" className={"side-menu" + (menuOpen ? " is-open" : "")}
        aria-label="Interplanetary Fund navigation" aria-hidden={!menuOpen}>
        <div className="side-menu-heading">
          <strong>Interplanetary Fund</strong>
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <nav className="side-nav" aria-label="Main menu">
          <strong>Explore</strong>
          <NavLink onClick={() => setMenuOpen(false)} to="/dashboard">Dashboard</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/discover">Discover</NavLink>
          <strong>Campaigns & Giving</strong>
          <NavLink onClick={() => setMenuOpen(false)} to="/create">New Campaign</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/mine">My Campaigns</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/giving">My Giving</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/following">Following</NavLink>
          <strong>Community</strong>
          <NavLink onClick={() => setMenuOpen(false)} to="/social">Interplanetary Social</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/inbox">Universal Inbox</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/blogs">Stories & Blogs</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/my-blog">My Blog Studio</NavLink>
          <strong>Account & Help</strong>
          <NavLink onClick={() => setMenuOpen(false)} to="/connections">Connections</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/notifications">Notifications</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to={user ? "/profile" : "/login"}>Profile</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/help">Help Center</NavLink>
          <NavLink onClick={() => setMenuOpen(false)} to="/about">About IFund</NavLink>
        </nav>
      </aside>
      <div className="platform-strip" aria-label="Connection destinations">
        {platforms.map((p) => (
          <Link
            key={p.id}
            to="/connections"
            title={p.name + " connection status"}
          >
            {p.name}
          </Link>
        ))}
      </div>
      {!configured && (
        <p className="setup-warning">
          Setup needed: configure the Supabase publishable key and apply the
          schema migration before the app can load live data.
        </p>
      )}
      {user === undefined && configured ? (
        <Loading />
      ) : (
        <Routes>
          <Route path="/" element={<Feed user={user} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/campaign/:id" element={<Detail user={user} />} />
          <Route
            path="/create"
            element={
              user ? (
                <Editor user={user} />
              ) : (
                <main>
                  <h1>Sign in before creating a campaign</h1>
                  <p>Sign in first so your draft is saved to your account.</p>
                  <Link to="/login?returnTo=%2Fcreate">Sign in</Link>
                </main>
              )
            }
          />
          <Route
            path="/edit/:id"
            element={
              user ? (
                <Editor user={user} />
              ) : (
                <main>
                  <h1>Sign in to edit a campaign</h1>
                  <Link to={"/login?returnTo=" + encodeURIComponent(location.pathname + location.search)}>Sign in</Link>
                </main>
              )
            }
          />
          <Route
            path="/mine"
            element={
              user ? (
                <MyCampaigns user={user} />
              ) : (
                <main>
                  <h1>My campaigns</h1>
                  <Link to="/login?returnTo=%2Fmine">Sign in to manage campaigns</Link>
                </main>
              )
            }
          />
          <Route path="/login" element={<Auth user={user} />} />
          <Route path="/connections" element={<Connections user={user} />} />
          <Route path="/community" element={<Community user={user} />} />
          <Route path="/social" element={<Community user={user} />} />
          <Route path="/profile" element={<Profile user={user} />} />
          <Route path="/giving" element={<MyGiving user={user} />} />
          <Route path="/following" element={<FollowedCampaigns user={user} />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/help" element={<Help />} />
          <Route path="/help/:slug" element={<HelpArticle />} />
          <Route path="/inbox" element={<Inbox user={user} />} />
          <Route path="/notifications" element={<Notifications user={user} />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blogs/:id" element={<BlogArticle />} />
          <Route path="/my-blog" element={<MyBlog user={user} />} />
          <Route
            path="*"
            element={
              <main>
                <h1>Page not found</h1>
                <Link to="/">Home</Link>
              </main>
            }
          />
        </Routes>
      )}
      <nav className="mobile-bottom-nav" aria-label="Mobile quick actions">
        <NavLink end to="/">Home</NavLink>
        <NavLink to="/discover">Explore</NavLink>
        <NavLink to="/create">Create</NavLink>
        <NavLink to="/mine">Campaigns</NavLink>
        <NavLink to="/social">Social</NavLink>
      </nav>
      <footer>
        <strong>Interplanetary Fund</strong>
        <p>What if? · Build with care, give with purpose.</p>
        <small>Preview migration build — no payment processing enabled.</small>
      </footer>
    </div>
  );
}
export default App;
