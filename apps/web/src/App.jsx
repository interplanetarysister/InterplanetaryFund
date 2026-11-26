import { lazy, Suspense, useEffect } from "react";
import "@/styles-connected-interactions.css";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { legacyAuthCallbackUrl } from "./lib/authFlow";
import { agentsRedirectSearch } from "./lib/agentsPage.mjs";
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
const Institutions = lazy(() => import("./pages/Institutions"));
const FundYourMission = lazy(() => import("./pages/FundYourMission"));
const SponsorWithIFund = lazy(() => import("./pages/SponsorWithIFund"));
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
  // Sprint 8 (2026-11-25): the legacy ?tab=publications deep link folds into
  // the IFund Social news tab (40-page list, page 24) instead of the retired
  // standalone /news route.
  return new URLSearchParams(search).get("tab") === "publications"
    ? <Navigate to="/social?tab=news" replace />
    : <SocialFeedPage />;
}
const SocialFeedPage = lazy(() => import("./pages/SocialFeedPage"));
const SocialPostPage = lazy(() => import("./pages/SocialPostPage"));
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
const Donate = lazy(() => import("./pages/Donate"));
const Inbox = lazy(() => import("./pages/Inbox"));
const Messaging = lazy(() => import("./pages/Messaging"));
const BlogArticle = lazy(() => import("./pages/BlogArticle"));
const PublicationArticle = lazy(() => import("./pages/PublicationArticle"));
const MyPublication = lazy(() => import("./pages/MyPublication"));
const EmbedCampaign = lazy(() => import("./pages/EmbedCampaign"));
const DownloadApp = lazy(() => import("./pages/DownloadApp"));
const AdminHub = lazy(() => import("./pages/AdminHub"));
const StudioPublishedPage = lazy(() => import("./pages/StudioPublishedPage"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const CampaignEngagement = lazy(() => import("./pages/CampaignEngagement"));
const ManagePermissions = lazy(() => import("./pages/ManagePermissions"));
const PublicSubscriptionPlans = lazy(() => import("./pages/PublicSubscriptionPlans"));
const MemberOnboarding = lazy(() => import("./pages/MemberOnboarding"));
const AdminSustainability = lazy(() => import("./pages/AdminSustainability"));
const MediaStudio = lazy(() => import("./pages/MediaStudio"));

// These two legacy routes still need independent, authorized backend parity.
// A release gate prevents preview publication while either is a placeholder.
const STANDALONE_COMING_SOON = [];
const LAYOUT_COMING_SOON = [];

const Loading = () => <div className="fixed inset-0 flex items-center justify-center bg-background"><BrandLogo size="lg" showName={false} className="animate-pulse" /></div>;

// Sprint 6 (2026-11-25): the legacy /analytics, /strategy and
// /communications routes fold into the single tabbed Agents page (40-page
// list, page 28). The redirect preserves any campaign query parameter and
// the #hash (for example /communications#reviewed-delivery), and stays
// behind MemberAccess exactly as the old routes were.
function LegacyAgentsRedirect({ tab }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/agents", search: agentsRedirectSearch(tab, search), hash }} replace />;
}

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
      {/* Sprint 8 (2026-11-25): /globe folds into Discover (40-page list,
          page 2) as the Globe tab rendering Atlas. /atlas pointed at /globe;
          it now goes straight to the same tab instead of chaining. */}
      <Route path="/globe" element={<Navigate to="/discover?tab=globe" replace />} />
      <Route path="/institutions" element={<Institutions />} />
      <Route path="/fund-your-mission" element={<FundYourMission />} />
      <Route path="/sponsor" element={<SponsorWithIFund />} />
      <Route path="/institutions/:id" element={<Institutions />} />
      <Route path="/atlas" element={<Navigate to="/discover?tab=globe" replace />} />
      <Route path="/agents" element={<AgentsTeam />} />
      <Route path="/messaging" element={<MemberAccess><Messaging /></MemberAccess>} />
      {/* Sprint 8 (2026-11-25): /mission was an Agents alias ("Mission Control")
          rendering AgentsTeam directly. It now redirects to the single tabbed
          Agents page (40-page list, page 28); the /missions list and workspace
          stay as compatibility routes under Campaign Workspace (page 19). */}
      <Route path="/mission" element={<Navigate to="/agents" replace />} />
      <Route path="/media-studio" element={<MemberAccess><MediaStudio /></MemberAccess>} />
      <Route path="/ai-images" element={<MemberAccess><Navigate to="/media-studio?tab=generator" replace /></MemberAccess>} />
      {/* Sprint 8 (2026-11-25): /devices folds into the Settings page as a
          section (40-page list, page 34). /permissions is the Settings page;
          ManagePermissions renders Devices.jsx under ?section=devices. */}
      <Route path="/devices" element={<MemberAccess><Navigate to="/permissions?section=devices" replace /></MemberAccess>} />
      {/* Sprint 8 (2026-11-25): /ops and /platform fold into the Admin
          Console (40-page list, page 40) as the Ops and Platform tabs.
          AdminHub gates those tabs behind super-admin access, exactly as
          these routes were gated; the redirect keeps the same wrappers. */}
      <Route path="/ops" element={<MemberAccess><SuperAdminAccess><Navigate to="/admin?tab=ops" replace /></SuperAdminAccess></MemberAccess>} />
      <Route path="/platform" element={<MemberAccess><SuperAdminAccess><Navigate to="/admin?tab=platform" replace /></SuperAdminAccess></MemberAccess>} />
      <Route path="/analytics" element={<MemberAccess><LegacyAgentsRedirect tab="analytics" /></MemberAccess>} />
      {/* Sprint 8 (2026-11-25): /donors and /engagement rendered the same
          CampaignEngagement component. /donors now redirects to /engagement,
          kept as the compatibility route under Campaign Workspace (page 19). */}
      <Route path="/donors" element={<MemberAccess><Navigate to="/engagement" replace /></MemberAccess>} />
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
      {/* Sprint 8 (2026-11-25): /support folds into Help Center (40-page
          list, page 11) as the Support tickets tab. The tab itself gates
          SupportTickets behind sign-in (AgentsTeam member-tab pattern); the
          redirect keeps the old route's MemberAccess wrapper. */}
      <Route path="/support" element={<MemberAccess><Navigate to="/help?tab=tickets" replace /></MemberAccess>} />
      <Route path="/engagement" element={<MemberAccess><CampaignEngagement /></MemberAccess>} />
      <Route path="/preferences" element={<Navigate to="/permissions?section=marketing" replace />} />
      <Route path="/permissions" element={<MemberAccess><ManagePermissions /></MemberAccess>} />
      <Route path="/strategy" element={<MemberAccess><LegacyAgentsRedirect tab="strategy" /></MemberAccess>} />
      <Route path="/communications" element={<MemberAccess><LegacyAgentsRedirect tab="communications" /></MemberAccess>} />
      <Route path="/admin" element={<MemberAccess><AdminAccess><AdminHub /></AdminAccess></MemberAccess>} />
      {/* Sprint 8 (2026-11-25): the admin sub-routes fold into the Admin
          Console (40-page list, page 40) as tabs. Each redirect keeps the
          route's original MemberAccess + AdminAccess/SuperAdminAccess
          wrappers, and AdminHub gates the same tabs per-tab. Exceptions:
          /admin/finance already redirects to /finances#platform-finance,
          and /planetary-impact stays its own public destination (page 39). */}
      <Route path="/admin/sponsor-inquiries" element={<MemberAccess><SuperAdminAccess><Navigate to="/admin?tab=sponsor-inquiries" replace /></SuperAdminAccess></MemberAccess>} />
      <Route path="/admin/finance" element={<MemberAccess><AdminAccess><Navigate to="/finances#platform-finance" replace /></AdminAccess></MemberAccess>} />
      <Route path="/admin/studio" element={<MemberAccess><SuperAdminAccess><Navigate to="/admin?tab=studio" replace /></SuperAdminAccess></MemberAccess>} />
      <Route path="/planetary-impact" element={<AdminSustainability />} />
      <Route path="/admin/sustainability" element={<MemberAccess><AdminAccess><Navigate to="/admin?tab=sustainability" replace /></AdminAccess></MemberAccess>} />
      <Route path="/admin/audit" element={<MemberAccess><SuperAdminAccess><Navigate to="/admin?tab=audit" replace /></SuperAdminAccess></MemberAccess>} />
      <Route path="/admin/deletions" element={<MemberAccess><SuperAdminAccess><Navigate to="/admin?tab=deletions" replace /></SuperAdminAccess></MemberAccess>} />
      <Route path="/admin/integrations" element={<MemberAccess><AdminAccess><Navigate to="/admin?tab=integrations" replace /></AdminAccess></MemberAccess>} />
      <Route path="/admin/help" element={<MemberAccess><SuperAdminAccess><Navigate to="/admin?tab=help" replace /></SuperAdminAccess></MemberAccess>} />
      <Route path="/social" element={<SocialRoute />} />
      <Route path="/social/post/:id" element={<SocialPostPage />} />
      <Route path="/admin/social-moderation" element={<MemberAccess><AdminAccess><Navigate to="/admin?tab=social-moderation" replace /></AdminAccess></MemberAccess>} />
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
      {/* Sprint 8 (2026-11-25): /blogs and /news fold into IFund Social
          (40-page list, page 24) as the Stories and News tabs. Detail routes
          /blogs/:id and /publications/:id stay standalone. */}
      <Route path="/blogs" element={<Navigate to="/social?tab=stories" replace />} />
      <Route path="/blog" element={<Navigate to="/social" replace />} />
      <Route path="/news" element={<Navigate to="/social?tab=news" replace />} />
      <Route path="/blogs/:id" element={<BlogArticle />} />
      <Route path="/publications/:id" element={<PublicationArticle />} />
      <Route path="/publication" element={<MemberAccess><MyPublication /></MemberAccess>} />
      <Route path="/my-blog" element={<MemberAccess><MyPublication /></MemberAccess>} />
      <Route path="/campaign/:id" element={<CampaignDetail />} />
      {/* Sprint 7 (2026-11-25): standalone Donate / Checkout page (40-page
          list, page 31). Public, like Campaign Detail — guests donate through
          the same embedded PayPal checkout. Campaign Detail keeps its own
          embedded Donate button and summary; this is an additional
          destination, not a replacement. */}
      <Route path="/donate" element={<Donate />} />
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
