import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useParams } from "react-router-dom";
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
import RequireAccess from "@/components/RequireAccess";
import MissingFeaturePage from "@/pages/MissingFeaturePage";
import { HISTORICAL_ROUTES } from "@/lib/historicalRoutes";
const EmbedCampaign = lazy(() => import("./pages/EmbedCampaign"));
const DownloadApp = lazy(() => import("./pages/DownloadApp"));
const Agents = lazy(() => import("./pages/Agents"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const MissionControlPage = lazy(() => import("./pages/MissionControlPage"));
const OpsCenter = lazy(() => import("./pages/OpsCenter"));
const Analytics = lazy(() => import("./pages/Analytics"));
const MyCampaigns = lazy(() => import("./pages/MyCampaigns"));
import { CAMPAIGN_UUID } from "./lib/ownerCampaigns";


// Exact source route inventory; a mounted page is not proof of feature parity.
const IMPLEMENTED = new Set([
  "/", "/about", "/terms", "/privacy", "/contact", "/login",
  "/register", "/forgot-password", "/reset-password", "/founding-members",
  "/discover", "/dashboard", "/social", "/community", "/create",
  "/profile", "/connections", "/campaign/:id", "/help", "/help/:slug",
  "/embed/campaign/:id", "/download", "/agents", "/onboarding", "/u/:id", "/mission", "/ops", "/analytics",
]);
const PENDING_ROUTES = HISTORICAL_ROUTES.filter(page => !IMPLEMENTED.has(page.path));
const STANDALONE_PATHS = new Set([
  "/globe", "/oauth/consent", "/activate", "/admin/organization-mail",
]);
const STANDALONE_PENDING = PENDING_ROUTES.filter(page => STANDALONE_PATHS.has(page.path));
const LAYOUT_PENDING = PENDING_ROUTES.filter(page => !STANDALONE_PATHS.has(page.path));
const pendingElement = page => <RequireAccess access={page.access}>
  <MissingFeaturePage page={page} />
</RequireAccess>;

function EditDraftRedirect() {
  const { id } = useParams();
  return CAMPAIGN_UUID.test(id || "") ? <Navigate replace to={"/create?draft=" + encodeURIComponent(id)} /> : <PageNotFound />;
}

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
    <Route path="/download" element={<DownloadApp />} />
    <Route path="/onboarding" element={<RequireAccess access="member"><Onboarding /></RequireAccess>} />
    <Route path="/embed/campaign/:id" element={<EmbedCampaign />} />
    {STANDALONE_PENDING.map(page => <Route key={page.path} path={page.path} element={pendingElement(page)} />)}
    <Route element={<Layout />}>
      <Route path="/discover" element={<Discover />} />
      <Route path="/dashboard" element={<RequireAccess access="member"><Dashboard /></RequireAccess>} />
      <Route path="/social" element={<SocialFeedPage />} />
      <Route path="/community" element={<SocialFeedPage community />} />
      <Route path="/create" element={<RequireAccess access="member"><CreateCampaign /></RequireAccess>} />
      <Route path="/edit/:id" element={<RequireAccess access="member"><EditDraftRedirect /></RequireAccess>} />
      <Route path="/mine" element={<RequireAccess access="member"><MyCampaigns /></RequireAccess>} />
      <Route path="/profile" element={<RequireAccess access="member"><Profile /></RequireAccess>} />
      <Route path="/connections" element={<RequireAccess access="member"><Connections /></RequireAccess>} />
      <Route path="/agents" element={<RequireAccess access="member"><Agents /></RequireAccess>} />
      <Route path="/mission" element={<RequireAccess access="member"><MissionControlPage /></RequireAccess>} />
      <Route path="/ops" element={<RequireAccess access="admin"><OpsCenter /></RequireAccess>} />
      <Route path="/analytics" element={<RequireAccess access="admin"><Analytics /></RequireAccess>} />
      <Route path="/u/:id" element={<PublicProfile />} />
      <Route path="/campaign/:id" element={<CampaignDetail />} />
      <Route path="/help" element={<Help />} />
      <Route path="/help/:slug" element={<HelpArticle />} />
      {LAYOUT_PENDING.map(page => <Route key={page.path} path={page.path} element={pendingElement(page)} />)}
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
