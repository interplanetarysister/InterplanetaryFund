import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { db, configured } from "./lib/supabase";
import { platforms } from "./lib/platforms";
import { SLOGAN } from "./lib/brand";
import { Planet, Loading } from "./components/UI";
import Feed from "./pages/Feed";
import Discover from "./pages/Discover";
import Detail from "./pages/CampaignDetail";
import Editor from "./pages/CampaignEditor";
import MyCampaigns from "./pages/MyCampaigns";
import Auth from "./pages/Auth";
import Connections from "./pages/Connections";
import Community from "./pages/Community";
import AdminStudio from "./pages/AdminStudio";

function App() {
  const [user, setUser] = useState(undefined);
  const [theme, setTheme] = useState("dark");
  const role = user?.app_metadata?.role;
  const canUseStudio = role === "admin" || role === "super_admin";

  useEffect(() => {
    if (!db) {
      setUser(null);
      return;
    }
    db.auth.getUser().then(({ data, error }) => {
      setUser(error ? null : data.user || null);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) =>
      setUser(session?.user || null),
    );
    return () => subscription.unsubscribe();
  }, []);

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
          <NavLink to="/connections">Connections</NavLink>
          <NavLink to="/mine">My campaigns</NavLink>
          {canUseStudio && <NavLink to="/admin/studio">Studio</NavLink>}
        </nav>
        <div className="actions top-actions">
          <button
            aria-label="Toggle theme"
            title="Toggle theme"
            onClick={() =>
              setTheme((t) => (t === "dark" ? "light" : "dark"))
            }
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
          <Route path="/discover" element={<Discover />} />
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
                  <Link to="/login">Sign in</Link>
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
                  <Link to="/login">Sign in</Link>
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
                  <Link to="/login">Sign in to manage campaigns</Link>
                </main>
              )
            }
          />
          <Route path="/login" element={<Auth user={user} />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/community" element={<Community user={user} />} />
          <Route
            path="/admin/studio"
            element={
              !user ? (
                <main>
                  <h1>Administrator sign-in required</h1>
                  <Link to="/login">Sign in</Link>
                </main>
              ) : canUseStudio ? (
                <AdminStudio />
              ) : (
                <main>
                  <h1>Administrator access required</h1>
                  <p>
                    This area is restricted to verified administrator accounts.
                  </p>
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
        <small>Preview migration build — no payment processing enabled.</small>
      </footer>
    </div>
  );
}
export default App;
