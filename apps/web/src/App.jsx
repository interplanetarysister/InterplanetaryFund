import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";
import BrandLogo from "@/components/brand/BrandLogo";
import ErrorBoundary from "@/components/ErrorBoundary";

const Layout = lazy(() => import("./components/Layout"));
const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Discover = lazy(() => import("./pages/Discover"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Help = lazy(() => import("./pages/Help"));
const Contact = lazy(() => import("./pages/Contact"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SocialFeedPage = lazy(() => import("./pages/SocialFeedPage"));
const CreateCampaign = lazy(() => import("./pages/CreateCampaign"));
const Profile = lazy(() => import("./pages/Profile"));
const Connections = lazy(() => import("./pages/Connections"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const FoundingMembers = lazy(() => import("./pages/FoundingMembers"));
const HelpArticle = lazy(() => import("./pages/HelpArticle"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const Blogs = lazy(() => import("./pages/Blogs"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));
const MyBlog = lazy(() => import("./pages/MyBlog"));

// Pages from the Base44 app that are not ported yet. Their links stay in the
// navigation and land on a branded "Coming soon" page instead of breaking.
const STANDALONE_COMING_SOON = [
  "/onboarding",
  "/globe", "/embed/campaign/:id", "/oauth/consent", "/activate",
];
const LAYOUT_COMING_SOON = [
  "/community/:id", "/u/:id", "/publications/:id",
  "/giving", "/communications", "/mission", "/ai-images",
  "/institutions", "/institutions/:id", "/devices", "/inbox",
  "/following", "/notifications", "/donors", "/ledger", "/subscriptions", "/withdrawals", "/agents",
  "/ops", "/platform", "/analytics", "/connect", "/admin/*",
];

const Loading = () => <div className="fixed inset-0 flex items-center justify-center bg-background"><BrandLogo size="lg" showName={false} className="animate-pulse" /></div>;

function AppRoutes() {
  return <Suspense fallback={<Loading />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/forgot-password" element={<AuthPage mode="forgot-password" />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/founding-members" element={<FoundingMembers />} />
    {STANDALONE_COMING_SOON.map((p) => <Route key={p} path={p} element={<ComingSoon />} />)}
    <Route element={<Layout />}>
      <Route path="/discover" element={<Discover />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/social" element={<SocialFeedPage />} />
      <Route path="/community" element={<SocialFeedPage community />} />
      <Route path="/create" element={<CreateCampaign />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/connections" element={<Connections />} />
      <Route path="/campaign/:id" element={<CampaignDetail />} />
      <Route path="/blogs" element={<Blogs />} />
      <Route path="/blogs/:id" element={<BlogArticle />} />
      <Route path="/my-blog" element={<MyBlog />} />
      <Route path="/help" element={<Help />} />
      <Route path="/help/:slug" element={<HelpArticle />} />
      {LAYOUT_COMING_SOON.map((p) => <Route key={p} path={p} element={<ComingSoon />} />)}
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes></Suspense>;
}

function App() {
  useEffect(() => {
    // Follow the device until someone explicitly picks a theme. Never override
    // a member's saved light/dark accessibility preference on system changes.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      let preference = "system";
      try { preference = localStorage.getItem("ifund-theme") || "system"; } catch { /* storage unavailable */ }
      document.documentElement.classList.toggle("dark", preference === "dark" || (preference === "system" && mq.matches));
      document.documentElement.style.colorScheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    window.addEventListener("ifund-theme-changed", apply);
    return () => { mq.removeEventListener("change", apply); window.removeEventListener("ifund-theme-changed", apply); };
  }, []);
  return <ErrorBoundary><Router><ScrollToTop /><AppRoutes /></Router></ErrorBoundary>;
}
export default App;
