import { lazy, Suspense, useEffect } from "react";
import "@/styles-connected-interactions.css";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { legacyAuthCallbackUrl } from "./lib/authFlow";
import PageNotFound from "./lib/PageNotFound";
import ScrollToTop from "./components/ScrollToTop";
import GlobalAgentCompanion from "./components/agents/GlobalAgentCompanion";
import PlatformSupportHostedButton from "./components/payments/PlatformSupportHostedButton";
import BrandLogo from "@/components/brand/BrandLogo";
import ErrorBoundary from "@/components/ErrorBoundary";
import MemberAccess from "@/components/auth/MemberAccess";
import AdminAccess from "@/components/auth/AdminAccess";
import SuperAdminAccess from "@/components/auth/SuperAdminAccess";

const Layout = lazy(() => import("./components/Layout"));
const Home = lazy(() => import("./pages/Home"));
const OurStory = lazy(() => import("./pages/OurStory"));
const HackathonDemo = lazy(() => import("./pages/HackathonDemo"));
const HackathonTracker = lazy(() => import("./pages/HackathonTracker"));
const About = lazy(() => import("./pages/About"));
const Discover = lazy(() => import("./pages/Discover"));
const Atlas = lazy(() => import("./pages/Atlas"));
const Institutions = lazy(() => import("./pages/Institutions"));
const FundYourMission = lazy(() => import("./pages/FundYourMission"));
const SponsorWithIFund = lazy(() => import("./pages/SponsorWithIFund"));
const AdminSponsorInquiries = lazy(() => import("./pages/AdminSponsorInquiries"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const HealthPrivacy = lazy(() => import("./pages/HealthPrivacy"));
const Help = lazy(() => import("./pages/Help"));
const FundraisingTips = lazy(() => import("./pages/FundraisingTips"));
const Contact = lazy(() => import("./pages/Contact"));
const AgentsTeam = lazy(() => import("./pages/AgentsTeam"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const MobileAuthCallbackNotice = lazy(() => import("./pages/MobileAuthCallbackNotice"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Events = lazy(() => import("./pages/Events"));
const FinanceDashboard = lazy(() => import("./pages/FinanceDashboard"));
function SocialRoute() {
  const { search } = useLocation();
  return new URLSearchParams(search).get("tab") === "publications"
    ? <Navigate to="/news" replace />
    : <SocialFeedPage />;
}
const SocialFeedPage = lazy(() => import("./pages/SocialFeedPage"));
const SocialPostPage = lazy(() => import("./pages/SocialPostPage"));
const SocialModeration = lazy(() => import("./pages/SocialModeration"));
const CreateCampaign = lazy(() => import("./pages/CreateCampaign"));
const CampaignTemplates = lazy(() => import("./pages/CampaignTemplates"));
const WhatIfStart = lazy(() => import("./pages/WhatIfStart"));
const MyMissions = lazy(() => import("./pages/MyMissions"));
const MissionWorkspace = lazy(() => import("./pages/MissionWorkspace"));
const WHAT_IF_ENABLED = import.meta.env.VITE_IFUND_WHAT_IF_ENABLED === "enabled";
const MyCampaigns = lazy(() => import("./pages/MyCampaigns"));
const EditCampaign = lazy(() => import("./pages/EditCampaign"));
const CampaignWorkspace = lazy(() => import("./pages/CampaignWorkspace"));
const PublicMemberProfile = lazy(() => import("./pages/PublicMemberProfile"));
const Profile = lazy(() => import("./pages/Profile"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const FundraisingPartners = lazy(() => import("./pages/FundraisingPartners"));
const ExternalFundingHub = lazy(() => import("./pages/ExternalFundingHub"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const WithdrawalVerification = lazy(() => import("./pages/WithdrawalVerification"));
const FoundingMembers = lazy(() => import("./pages/FoundingMembers"));
const HelpArticle = lazy(() => import("./pages/HelpArticle"));
const LegacyAuthorizationNotice = lazy(() => import("./pages/LegacyAuthorizationNotice"));
const CommunityDetail = lazy(() => import("./pages/CommunityDetail"));
const FollowedCampaigns = lazy(() => import("./pages/FollowedCampaigns"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Messaging = lazy(() => import("./pages/Messaging"));
const Blogs = lazy(() => import("./pages/Blogs"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));
const PublicationArticle = lazy(() => import("./pages/PublicationArticle"));
const MyPublication = lazy(() => import("./pages/MyPublication"));
const EmbedCampaign = lazy(() => import("./pages/EmbedCampaign"));
const DownloadApp = lazy(() => import("./pages/DownloadApp"));
const AdminStudio = lazy(() => import("./pages/AdminStudio"));
const AdminHub = lazy(() => import("./pages/AdminHub"));
const AdminDeletionQueue = lazy(() => import("./pages/AdminDeletionQueue"));
const StudioPublishedPage = lazy(() => import("./pages/StudioPublishedPage"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const CampaignEngagement = lazy(() => import("./pages/CampaignEngagement"));
const ManagePermissions = lazy(() => import("./pages/ManagePermissions"));
const CampaignStrategy = lazy(() => import("./pages/CampaignStrategy"));
const CommunicationsWorkspace = lazy(() => import("./pages/CommunicationsWorkspace"));
const PublicSubscriptionPlans = lazy(() => import("./pages/PublicSubscriptionPlans"));
const MemberOnboarding = lazy(() => import("./pages/MemberOnboarding"));
const Devices = lazy(() => import("./pages/Devices"));
const OperationsHub = lazy(() => import("./pages/OperationsHub"));
const AnalyticsCenter = lazy(() => import("./pages/AnalyticsCenter"));
const AdminSustainability = lazy(() => import("./pages/AdminSustainability"));
const AdminAudit = lazy(() => import("./pages/AdminAudit"));
const AdminHelpEditor = lazy(() => import("./pages/AdminHelpEditor"));
const AdminConnections = lazy(() => import("./pages/AdminConnections"));
const AIImageStudio = lazy(() => import("./pages/AIImageStudio"));

// These two legacy routes still need independent, authorized backend parity.
// A release gate prevents preview publication while either is a placeholder.
const STANDALONE_COMING_SOON = [];
const LAYOUT_COMING_SOON = [];

const Loading = () => <div className="fixed inset-0 flex items-center justify-center bg-background"><BrandLogo size="lg" showName={false} className="animate-pulse" /></div>;

function AppRoutes() {
  const location = useLocation();
  const legacy = legacyAuthCallbackUrl(window.location.origin + location.pathname + location.search + location.hash);
  if (legacy) return <Navigate to={legacy} replace />;
  return <Suspense fallback={<Loading />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/our-story" element={<OurStory />} />
    <Route path="/hackathon" element={<HackathonDemo />} />
    <Route path="/hackathon/tracker" element={<MemberAccess><SuperAdminAccess><HackathonTracker /></SuperAdminAccess></MemberAccess>} />
    <Route path="/about" element={<About />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/delete-account" element={<DeleteAccount />} />
    <Route path="/health-privacy" element={<HealthPrivacy />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/login" element={<AuthPage key="login" mode="login" />} />
    <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    <Route path="/forgot-password" element={<AuthPage key="forgot-password" mode="forgot-password" />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/oauth/callback/:provider" element={<OAuthCallback />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/mobile-callback" element={<MobileAuthCallbackNotice />} />
    <Route path="/onboarding" element={<MemberAccess><MemberOnboarding /></MemberAccess>} />
    <Route path="/activate" element={<Navigate to="/login" replace />} />
    <Route path="/founding-members" element={<FoundingMembers />} />
    <Route path="/download" element={<DownloadApp />} />
    <Route path="/p/:slug" element={<StudioPublishedPage />} />
    <Route path="/embed/campaign/:id" element={<EmbedCampaign />} />
    <Route path="/oauth/consent" element={<LegacyAuthorizationNotice />} />
    <Route element={<Layout />}>
      <Route path="/discover" element={<Discover />} />
      <Route path="/shorts" element={<Navigate to="/social?tab=shorts" replace />} />
      <Route path="/globe" element={<Atlas />} />
      <Route path="/institutions" element={<Institutions />} />
      <Route path="/fund-your-mission" element={<FundYourMission />} />
      <Route path="/sponsor" element={<SponsorWithIFund />} />
      <Route path="/institutions/:id" element={<Institutions />} />
      <Route path="/atlas" element={<Navigate to="/globe" replace />} />
      <Route path="/agents" element={<AgentsTeam />} />
      <Route path="/messaging" element={<MemberAccess><Messaging /></MemberAccess>} />
      <Route path="/mission" element={<AgentsTeam />} />
      <Route path="/ai-images" element={<MemberAccess><AIImageStudio /></MemberAccess>} />
      <Route path="/devices" element={<MemberAccess><Devices /></MemberAccess>} />
      <Route path="/ops" element={<MemberAccess><SuperAdminAccess><OperationsHub /></SuperAdminAccess></MemberAccess>} />
      <Route path="/platform" element={<MemberAccess><SuperAdminAccess><OperationsHub platform /></SuperAdminAccess></MemberAccess>} />
      <Route path="/analytics" element={<MemberAccess><AnalyticsCenter /></MemberAccess>} />
      <Route path="/donors" element={<MemberAccess><CampaignEngagement /></MemberAccess>} />
      <Route path="/connect" element={<Navigate to="/connections" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/events" element={<Events />} />
      <Route path="/events/:id" element={<Events />} />
      <Route path="/finances" element={<MemberAccess><FinanceDashboard /></MemberAccess>} />
      <Route path="/ledger" element={<Navigate to="/finances#campaign-finances" replace />} />
      <Route path="/giving" element={<Navigate to="/finances#giving-receipts" replace />} />
      <Route path="/withdrawals" element={<WithdrawalVerification />} />
      <Route path="/plans" element={<PublicSubscriptionPlans />} />
      <Route path="/subscriptions" element={<MemberAccess><Subscriptions /></MemberAccess>} />
      <Route path="/support" element={<MemberAccess><SupportTickets /></MemberAccess>} />
      <Route path="/engagement" element={<MemberAccess><CampaignEngagement /></MemberAccess>} />
      <Route path="/preferences" element={<Navigate to="/permissions?section=marketing" replace />} />
      <Route path="/permissions" element={<MemberAccess><ManagePermissions /></MemberAccess>} />
      <Route path="/strategy" element={<MemberAccess><CampaignStrategy /></MemberAccess>} />
      <Route path="/communications" element={<MemberAccess><CommunicationsWorkspace /></MemberAccess>} />
      <Route path="/admin" element={<MemberAccess><AdminAccess><AdminHub /></AdminAccess></MemberAccess>} />
      <Route path="/admin/sponsor-inquiries" element={<MemberAccess><SuperAdminAccess><AdminSponsorInquiries /></SuperAdminAccess></MemberAccess>} />
      <Route path="/admin/finance" element={<MemberAccess><AdminAccess><Navigate to="/finances#platform-finance" replace /></AdminAccess></MemberAccess>} />
      <Route path="/admin/studio" element={<MemberAccess><SuperAdminAccess><AdminStudio /></SuperAdminAccess></MemberAccess>} />
      <Route path="/planetary-impact" element={<AdminSustainability />} />
      <Route path="/admin/sustainability" element={<MemberAccess><AdminAccess><AdminSustainability /></AdminAccess></MemberAccess>} />
      <Route path="/admin/audit" element={<MemberAccess><SuperAdminAccess><AdminAudit /></SuperAdminAccess></MemberAccess>} />
      <Route path="/admin/deletions" element={<MemberAccess><SuperAdminAccess><AdminDeletionQueue /></SuperAdminAccess></MemberAccess>} />
      <Route path="/admin/integrations" element={<MemberAccess><AdminAccess><AdminConnections /></AdminAccess></MemberAccess>} />
      <Route path="/admin/help" element={<MemberAccess><SuperAdminAccess><AdminHelpEditor /></SuperAdminAccess></MemberAccess>} />
      <Route path="/social" element={<SocialRoute />} />
      <Route path="/social/post/:id" element={<SocialPostPage />} />
      <Route path="/admin/social-moderation" element={<MemberAccess><AdminAccess><SocialModeration /></AdminAccess></MemberAccess>} />
      <Route path="/community" element={<SocialFeedPage community />} />
      <Route path="/community/:id" element={<CommunityDetail />} />
      <Route path="/what-if" element={WHAT_IF_ENABLED ? <WhatIfStart/> : <Navigate to="/create?manual=1" replace/>} />
      <Route path="/missions" element={WHAT_IF_ENABLED ? <MemberAccess><MyMissions/></MemberAccess> : <Navigate to="/dashboard" replace/>} />
      <Route path="/missions/:id" element={WHAT_IF_ENABLED ? <MemberAccess><MissionWorkspace/></MemberAccess> : <Navigate to="/dashboard" replace/>} />
      <Route path="/create" element={<CreateCampaign />} />
      <Route path="/templates" element={<CampaignTemplates />} />
      <Route path="/campaigns" element={<MemberAccess><MyCampaigns /></MemberAccess>} />
      <Route path="/campaigns/:id/edit" element={<MemberAccess><EditCampaign /></MemberAccess>} />
      <Route path="/workspace/campaign/:id" element={<MemberAccess><CampaignWorkspace /></MemberAccess>} />
      <Route path="/profile" element={<MemberAccess><Profile /></MemberAccess>} />
      <Route path="/my-profile" element={<Navigate to="/profile" replace />} />
      <Route path="/u/:id" element={<PublicMemberProfile />} />
      <Route path="/connections" element={<MemberAccess><ManagePermissions /></MemberAccess>} />
      <Route path="/fundraising-partners" element={<FundraisingPartners />} />
      <Route path="/fundraising-hub" element={<MemberAccess><ExternalFundingHub /></MemberAccess>} />
      <Route path="/following" element={<MemberAccess><FollowedCampaigns /></MemberAccess>} />
      <Route path="/notifications" element={<MemberAccess><Notifications /></MemberAccess>} />
      <Route path="/mail" element={<MemberAccess><Inbox /></MemberAccess>} />
      {/* Legacy deep links remain valid; do not lose saved /inbox message destinations. */}
      <Route path="/inbox" element={<MemberAccess><Inbox /></MemberAccess>} />
      <Route path="/blogs" element={<Blogs />} />
      <Route path="/blog" element={<Navigate to="/social" replace />} />
      <Route path="/news" element={<Blogs news />} />
      <Route path="/blogs/:id" element={<BlogArticle />} />
      <Route path="/publications/:id" element={<PublicationArticle />} />
      <Route path="/publication" element={<MemberAccess><MyPublication /></MemberAccess>} />
      <Route path="/my-blog" element={<MemberAccess><MyPublication /></MemberAccess>} />
      <Route path="/campaign/:id" element={<CampaignDetail />} />
      <Route path="/help" element={<Help />} />
      <Route path="/fundraising-tips" element={<FundraisingTips />} />
      <Route path="/help/:slug" element={<HelpArticle />} />
      <Route path="/admin/*" element={<PageNotFound />} />

    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>{(["/", "/about", "/terms", "/privacy", "/health-privacy", "/contact", "/founding-members", "/download"].includes(location.pathname)) && <PlatformSupportHostedButton />}</Suspense>;
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
  return <ErrorBoundary><Router><ScrollToTop /><GlobalAgentCompanion><AppRoutes /></GlobalAgentCompanion></Router></ErrorBoundary>;
}
export default App;
