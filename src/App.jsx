import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { db, configured } from "./lib/supabase";
import { platforms } from "./lib/platforms";
import { SLOGAN } from "./lib/brand";
import { loginPathFor } from "./lib/authReturnTo";
import { Planet, Loading } from "./components/UI";
import Feed from "./pages/Feed";
import Discover from "./pages/Discover";
import Detail from "./pages/CampaignDetail";
import Editor from "./pages/CampaignEditor";
import MyCampaigns from "./pages/MyCampaigns";
import Auth from "./pages/Auth";
import Connections from "./pages/Connections";
import Community from "./pages/Community";
import Blogs from "./pages/Blogs";
import BlogArticle from "./pages/BlogArticle";
import MyBlog from "./pages/MyBlog";
import AdminStudio from "./pages/AdminStudio";
import StudioPublishedPage from "./pages/StudioPublishedPage";
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
  const [theme, setTheme] = useState("dark");
  const [studioAccess, setStudioAccess] = useState(null);
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
    let active = true;
    if (!user || !db) {
      setStudioAccess(false);
      return () => {
        active = false;
      };
    }
    setStudioAccess(null);
    db.rpc("ifund_current_user_is_verified_super_admin")
      .then(({ data, error }) => {
        if (active) setStudioAccess(!error && data === true);
      })
      .catch(() => {
        if (active) setStudioAccess(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
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
        <nav>
          <NavLink end to="/">
            Home
          </NavLink>
          <NavLink to="/discover">Explore</NavLink>
          <NavLink to="/community">Community</NavLink>
          <NavLink to="/blogs">Reporter</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/help">Help</NavLink>
          <NavLink to="/connections">Connections</NavLink>
          <NavLink to="/mine">My campaigns</NavLink>
          {studioAccess === true && <NavLink to="/admin/studio">Studio</NavLink>}
        </nav>
        <div className="actions top-actions">
          <button
            aria-label="Toggle theme"
            title="Toggle theme"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            ◐
          </button>
          <Link to="/login">{user ? "Account" : "Sign in"}</Link>
        </div>
      </header>
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
          <Route path="/" element={<Feed />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<Help />} />
          <Route path="/help/:slug" element={<HelpArticle />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/campaign/:id" element={<Detail />} />
          <Route path="/create" element={<Editor user={user} />} />
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
          <Route path="/connections" element={user ? <Connections /> : <main><h1>Sign in to manage your connections</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/community" element={<Community user={user} />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/blogs/:id" element={<BlogArticle />} />
          <Route path="/my-blog" element={user ? <MyBlog user={user} /> : <main><h1>Sign in to manage your publication</h1><Link to={loginPath}>Sign in</Link></main>} />
          <Route path="/p/:slug" element={<StudioPublishedPage />} />
          <Route
            path="/admin/studio"
            element={
              !user ? (
                <main>
                  <h1>Administrator sign-in required</h1>
                  <Link to={loginPath}>Sign in</Link>
                </main>
              ) : studioAccess === null ? (
                <Loading />
              ) : studioAccess === true ? (
                <AdminStudio />
              ) : (
                <main>
                  <h1>Verified super-administrator access required</h1>
                  <p>This area is restricted to verified IFund super-administrator accounts.</p>
                  <Link to="/">Return home</Link>
                </main>
              )
            }
          />
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
