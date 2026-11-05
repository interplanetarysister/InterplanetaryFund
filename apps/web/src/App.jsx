import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { legacyAuthCallbackUrl } from "./lib/authFlow";
import PageNotFound from "./lib/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";
import PlatformSupportHostedButton from "./components/payments/PlatformSupportHostedButton";
import BrandLogo from "@/components/brand/BrandLogo";
import ErrorBoundary from "@/components/ErrorBoundary";
import MemberAccess from "@/components/auth/MemberAccess";
import AdminAccess from "@/components/auth/AdminAccess";
import SuperAdminAccess from "@/components/auth/SuperAdminAccess";

const Layout = lazy(() => import("./components/Layout"));
const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Discover = lazy(() => import("./pages/Discover"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Help = lazy(() => import("./pages/Help"));
const Contact = lazy(() => import("./pages/Contact"));
const StoryAgent = lazy(() => import("./pages/StoryAgent"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SocialFeedPage = lazy(() => import("./pages/SocialFeedPage"));
const CreateCampaign = lazy(() => import("./pages/CreateCampaign"));
const MyCampaigns = lazy(() => import("./pages/MyCampaigns"));
const EditCampaign = lazy(() => import("./pages/EditCampaign"));
const Profile = lazy(() => import("./pages/Profile"));
const Connections = lazy(() => import("./pages/Connections"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const FoundingMembers = lazy(() => import("./pages/FoundingMembers"));
const HelpArticle = lazy(() => import("./pages/HelpArticle"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const FollowedCampaigns = lazy(() => import("./pages/FollowedCampaigns"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Blogs = lazy(() => import("./pages/Blogs"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));
const PublicationArticle = lazy(() => import("./pages/PublicationArticle"));
const MyPublication = lazy(() => import("./pages/MyPublication"));
const EmbedCampaign = lazy(() => import("./pages/EmbedCampaign"));
const DownloadApp = lazy(() => import("./pages/DownloadApp"));
const AdminStudio = lazy(() => import("./pages/AdminStudio"));
const StudioPublishedPage = lazy(() => import("./pages/StudioPublishedPage"));

// Pages from the Base44 app that are not ported yet. Their links stay in the
// navigation and land on a branded "Coming soon" page instead of breaking.
const STANDALONE_COMING_SOON = [
  "/onboarding",
  "/globe", "/oauth/consent", "/activate",
];
const LAYOUT_COMING_SOON = [
  "/community/:id", "/u/:id",
  "/giving", "/communications", "/mission", "/ai-images",
  "/institutions", "/institutions/:id", "/my-blog", "/devices",
  "/donors", "/ledger", "/subscriptions", "/withdrawals",
  "/ops", "/platform", "/analytics", "/connect", "/admin/*",
];

const Loading = () => <div className="fixed inset-0 flex items-center justify-center bg-background"><BrandLogo size="lg" showName={false} className="animate-pulse" /></div>;

function AppRoutes() {
  const location = useLocation();
  const legacy = legacyAuthCallbackUrl(window.location.origin + location.pathname + location.search + location.hash);
  if (legacy) return <Navigate to={legacy} replace />;
  return <Suspense fallback={<Loading />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/login" element={<AuthPage key="login" mode="login" />} />
    <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    <Route path="/forgot-password" element={<AuthPage key="forgot-password" mode="forgot-password" />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/founding-members" element={<FoundingMembers />} />
    <Route path="/download" element={<DownloadApp />} />
    <Route path="/p/:slug" element={<StudioPublishedPage />} />
    <Route path="/embed/campaign/:id" element={<EmbedCampaign />} />
    {STANDALONE_COMING_SOON.map((p) => <Route key={p} path={p} element={<ComingSoon />} />)}
    <Route element={<Layout />}>
      <Route path="/discover" element={<Discover />} />
      <Route path="/agents" element={<MemberAccess><StoryAgent /></MemberAccess>} />
      <Route path="/dashboard" element={<MemberAccess><Dashboard /></MemberAccess>} />
      <Route path="/admin/studio" element={<MemberAccess><SuperAdminAccess><AdminStudio /></SuperAdminAccess></MemberAccess>} />
      <Route path="/social" element={<SocialFeedPage />} />
      <Route path="/community" element={<SocialFeedPage community />} />
      <Route path="/create" element={<CreateCampaign />} />
      <Route path="/campaigns" element={<MemberAccess><MyCampaigns /></MemberAccess>} />
      <Route path="/campaigns/:id/edit" element={<MemberAccess><EditCampaign /></MemberAccess>} />
      <Route path="/profile" element={<MemberAccess><Profile /></MemberAccess>} />
      <Route path="/connections" element={<MemberAccess><Connections /></MemberAccess>} />
      <Route path="/following" element={<MemberAccess><FollowedCampaigns /></MemberAccess>} />
      <Route path="/notifications" element={<MemberAccess><Notifications /></MemberAccess>} />
      <Route path="/inbox" element={<MemberAccess><Inbox /></MemberAccess>} />
      <Route path="/blogs" element={<Blogs />} />
      <Route path="/blogs/:id" element={<BlogArticle />} />
      <Route path="/publications/:id" element={<PublicationArticle />} />
      <Route path="/publication" element={<MemberAccess><MyPublication /></MemberAccess>} />
      <Route path="/my-blog" element={<MemberAccess><MyPublication /></MemberAccess>} />
      <Route path="/campaign/:id" element={<CampaignDetail />} />
      <Route path="/help" element={<Help />} />
      <Route path="/help/:slug" element={<HelpArticle />} />
      {LAYOUT_COMING_SOON.map((p) => <Route key={p} path={p} element={<ComingSoon />} />)}
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>{(["/", "/about", "/terms", "/privacy", "/contact", "/founding-members", "/download"].includes(location.pathname)) && <PlatformSupportHostedButton />}</Suspense>;
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
