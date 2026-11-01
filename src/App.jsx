import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { db, configured } from "./lib/supabase";
import { Loading } from "./components/UI";
import MigrationShell from "./components/MigrationShell";
import Feed from "./pages/Feed";
import Discover from "./pages/Discover";
import Detail from "./pages/CampaignDetail";
import Editor from "./pages/CampaignEditor";
import MyCampaigns from "./pages/MyCampaigns";
import Auth from "./pages/Auth";
import Connections from "./pages/Connections";
import Community from "./pages/Community";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
function initialTheme() {
  try {
    const saved = window.localStorage.getItem("ifund-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Storage may be disabled. */
  }
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}
function App() {
  const [user, setUser] = useState(undefined);
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    if (!db) {
      setUser(null);
      return;
    }
    db.auth
      .getUser()
      .then(({ data }) => setUser(data?.user || null))
      .catch(() => setUser(null));
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user || null),
    );
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("ifund-theme", theme);
    } catch {}
  }, [theme]);
  return (
    <div className="app">
      <MigrationShell user={user} theme={theme} setTheme={setTheme}>
        {!configured && (
          <p className="setup-warning">
            Setup needed: configure the Supabase publishable key and verify the
            schema before the app can load live data.
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
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/login" element={<Auth user={user} />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/community" element={<Community user={user} />} />
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
      </MigrationShell>
    </div>
  );
}
export default App;
