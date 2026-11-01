import "./navigation.css";
import { Bot, UserRound, Radio, Users, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { db, configured } from "./lib/supabase";
import { SLOGAN } from "./lib/brand";
import { loginPathFor } from "./lib/authReturnTo";
import { Planet, Loading } from "./components/UI";
import Feed from "./pages/Feed";
import Dashboard from "./pages/Dashboard";
import VisualWorkspace from "./pages/VisualWorkspace";
import Following from "./pages/Following";
import MissionControl from "./pages/MissionControl";
import SignalAlerts from "./pages/SignalAlerts";
import CommsCenter from "./pages/CommsCenter";
import AgentsPreview from "./pages/AgentsPreview";
import InboxPreview from "./pages/InboxPreview";
import Discover from "./pages/Discover";
import PlanetaryAtlas from "./pages/PlanetaryAtlas";
import Detail from "./pages/CampaignDetail";
import Editor from "./pages/CampaignEditor";
import MyCampaigns from "./pages/MyCampaigns";
import Auth from "./pages/Auth";
import Connections from "./pages/Connections";
import Community from "./pages/Community";
import Blogs from "./pages/Blogs";
import BlogArticle from "./pages/BlogArticle";
import MyBlog from "./pages/MyBlog";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Help from "./pages/Help";
import HelpArticle from "./pages/HelpArticle";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
function App() {
  const location = useLocation();
  const loginPath = loginPathFor(location);
  const [user, setUser] = useState(undefined);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("ifund-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch { return "dark"; } });
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!db) {
      setUser(null);
      return;
    }
    db.auth.getUser().then(({ data }) => setUser(data?.user || null)).catch(() => setUser(null));
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) =>
      setUser(session?.user || null),
    );
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("ifund-theme", theme); } catch {}
  }, [theme]);
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
        <button type="button" className="ifund-menu-toggle" aria-expanded={menuOpen} aria-controls="ifund-primary-nav" onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <><X size={18}/> Close</> : <><Menu size={18}/> Menu</>}</button>
        <nav id="ifund-primary-nav" className={menuOpen ? "ifund-primary-nav is-open" : "ifund-primary-nav"} aria-label="Main navigation">
          <div className="ifund-nav-group"><span>Explore</span><NavLink end to="/">Launchpad</NavLink><NavLink to="/discover">Explore Universe</NavLink><NavLink to="/globe">Planetary Atlas</NavLink><NavLink to="/community">Community Hub</NavLink><NavLink to="/blogs">Star Stories</NavLink></div>
          <div className="ifund-nav-group"><span>Campaigns & Giving</span><NavLink to="/create">Launch a Mission</NavLink><NavLink to="/dashboard">Mission Dashboard</NavLink><NavLink to="/mine">My Missions</NavLink><NavLink to="/following">Orbiting Causes</NavLink></div>
          <div className="ifund-nav-group"><span>Account & Help</span><NavLink to="/connections">Mission Links</NavLink><NavLink to="/help">Help Center</NavLink><NavLink to="/about">About</NavLink></div>
        </nav>
        <div className="actions top-actions">
          <button
            aria-label="Toggle theme"
            title="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            ◐
          </button>
          <Link to={user ? "/dashboard" : "/login"}>{user ? "My dashboard" : "Sign in"}</Link>
        </div>
      </header>
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
          <Route path="/" element={<Feed />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<Help />} />
          <Route path="/help/:slug" element={<HelpArticle />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/globe" element={<PlanetaryAtlas />} />
          <Route path="/agents" element={user ? <AgentsPreview /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/mission" element={user ? <MissionControl user={user} /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/ai-images" element={user ? <VisualWorkspace path="/ai-images" /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/inbox" element={user ? <InboxPreview /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/following" element={user ? <Following user={user} /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/giving" element={user ? <VisualWorkspace path="/giving" /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/ledger" element={user ? <VisualWorkspace path="/ledger" /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/withdrawals" element={user ? <VisualWorkspace path="/withdrawals" /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/notifications" element={user ? <SignalAlerts user={user} /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/communications" element={user ? <CommsCenter /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/institutions" element={user ? <VisualWorkspace path="/institutions" /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/subscriptions" element={user ? <VisualWorkspace path="/subscriptions" /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/donors" element={user ? <VisualWorkspace path="/donors" /> : <main><h1>Sign in to continue</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/profile" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
          <Route path="/social" element={<Community user={user} />} />
          <Route path="/campaign/:id" element={<Detail />} />
          <Route
            path="/create"
            element={
              user ? (
                <Editor user={user} />
              ) : (
                <main>
                  <h1>Sign in before creating a campaign</h1>
                  <p>Sign in first so your draft is saved to your account.</p>
                  <Link to={loginPath}>Sign in</Link>
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
                  <Link to={loginPath}>Sign in</Link>
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
                  <Link to={loginPath}>Sign in to manage campaigns</Link>
                </main>
              )
            }
          />
          <Route path="/login" element={<Auth user={user} />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <main><h1>Dashboard</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/connections" element={user ? <Connections /> : <main><h1>Sign in to manage your connections</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/community" element={<Community user={user} />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blogs/:id" element={<BlogArticle />} />
          <Route path="/my-blog" element={user ? <MyBlog user={user} /> : <main><h1>Sign in to manage your publication</h1><Link to={loginPath}>Sign in</Link></main>} />
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
      <nav className="ifund-bottom-nav" aria-label="Mobile navigation">
        <NavLink to={user ? "/agents" : loginPath} aria-label="AI Team"><Bot size={21}/><span>AI Team</span></NavLink>
        <NavLink to={user ? "/dashboard" : loginPath} aria-label="Dashboard"><UserRound size={21}/><span>Dashboard</span></NavLink>
        <NavLink to="/social" aria-label="IFund Social"><Radio size={21}/><span>IFund Social</span></NavLink>
        <NavLink to="/community" aria-label="Forums"><Users size={21}/><span>Forums</span></NavLink>
      </nav>
      <footer>
        <strong>Interplanetary Fund</strong>
        <p>What if? · Build with care, give with purpose.</p>
        <nav aria-label="Legal and support links" className="footer-nav">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/help">Help</Link>
        </nav>
        <small>Preview migration build — no payment processing enabled.</small>
      </footer>
    </div>
  );
}
export default App;
