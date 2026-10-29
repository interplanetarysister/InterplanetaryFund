// Code-derived route contract from issue #137 and original src/App.jsx.
// A route is NOT implemented merely because it appears here.
export const HISTORICAL_ROUTES = Object.freeze([
  {
    "path": "/login",
    "title": "Sign in",
    "access": "public",
    "source_component": "Login"
  },
  {
    "path": "/register",
    "title": "Create an account",
    "access": "public",
    "source_component": "Register"
  },
  {
    "path": "/forgot-password",
    "title": "Recover account",
    "access": "public",
    "source_component": "ForgotPassword"
  },
  {
    "path": "/reset-password",
    "title": "Reset password",
    "access": "public",
    "source_component": "ResetPassword"
  },
  {
    "path": "/globe",
    "title": "Global Globe",
    "access": "public",
    "source_component": "GlobalGlobe"
  },
  {
    "path": "/embed/campaign/:id",
    "title": "Embedded campaign",
    "access": "public",
    "source_component": "EmbedCampaign"
  },
  {
    "path": "/oauth/consent",
    "title": "Authorize integration",
    "access": "public",
    "source_component": "OAuthConsent"
  },
  {
    "path": "/activate",
    "title": "Activate device",
    "access": "public",
    "source_component": "DeviceActivation"
  },
  {
    "path": "/",
    "title": "Home",
    "access": "public",
    "source_component": "Home"
  },
  {
    "path": "/about",
    "title": "About",
    "access": "public",
    "source_component": "About"
  },
  {
    "path": "/founding-members",
    "title": "Founding members",
    "access": "public",
    "source_component": "FoundingMembers"
  },
  {
    "path": "/terms",
    "title": "Terms of Service",
    "access": "public",
    "source_component": "Terms"
  },
  {
    "path": "/privacy",
    "title": "Privacy Policy",
    "access": "public",
    "source_component": "Privacy"
  },
  {
    "path": "/contact",
    "title": "Contact",
    "access": "public",
    "source_component": "Contact"
  },
  {
    "path": "/admin/organization-mail",
    "title": "Organization mail",
    "access": "specially protected administration",
    "source_component": "IndependentAdminMail"
  },
  {
    "path": "/download",
    "title": "Download IFund",
    "access": "public",
    "source_component": "DownloadApp"
  },
  {
    "path": "/discover",
    "title": "Discover campaigns",
    "access": "public",
    "source_component": "Discover"
  },
  {
    "path": "/campaign/:id",
    "title": "Campaign",
    "access": "public",
    "source_component": "CampaignDetail"
  },
  {
    "path": "/community",
    "title": "Community",
    "access": "public",
    "source_component": "Community"
  },
  {
    "path": "/community/:id",
    "title": "Community discussion",
    "access": "public",
    "source_component": "CommunityDetail"
  },
  {
    "path": "/u/:id",
    "title": "Member profile",
    "access": "public",
    "source_component": "PublicProfile"
  },
  {
    "path": "/social",
    "title": "IFund Social",
    "access": "public",
    "source_component": "Social"
  },
  {
    "path": "/blogs",
    "title": "Stories & Blogs",
    "access": "public",
    "source_component": "Blogs"
  },
  {
    "path": "/blogs/:id",
    "title": "Story",
    "access": "public",
    "source_component": "BlogArticle"
  },
  {
    "path": "/publications/:id",
    "title": "Publication",
    "access": "public",
    "source_component": "PublicationArticle"
  },
  {
    "path": "/help",
    "title": "Help Center",
    "access": "public",
    "source_component": "Help"
  },
  {
    "path": "/help/:slug",
    "title": "Help article",
    "access": "public",
    "source_component": "HelpArticle"
  },
  {
    "path": "/onboarding",
    "title": "Get started",
    "access": "member",
    "source_component": "Onboarding"
  },
  {
    "path": "/dashboard",
    "title": "Dashboard",
    "access": "member",
    "source_component": "Dashboard"
  },
  {
    "path": "/create",
    "title": "New campaign",
    "access": "member",
    "source_component": "CreateCampaign"
  },
  {
    "path": "/giving",
    "title": "My Giving",
    "access": "member",
    "source_component": "MyGiving"
  },
  {
    "path": "/communications",
    "title": "Communications",
    "access": "member",
    "source_component": "Communications"
  },
  {
    "path": "/mission",
    "title": "Mission Control",
    "access": "member",
    "source_component": "MissionControlPage"
  },
  {
    "path": "/ai-images",
    "title": "AI Image Studio",
    "access": "member",
    "source_component": "AIImageStudio"
  },
  {
    "path": "/institutions",
    "title": "Institutions",
    "access": "member",
    "source_component": "Institutions"
  },
  {
    "path": "/institutions/:id",
    "title": "Institution",
    "access": "member",
    "source_component": "InstitutionDetail"
  },
  {
    "path": "/profile",
    "title": "Profile",
    "access": "member",
    "source_component": "Profile"
  },
  {
    "path": "/my-blog",
    "title": "My Blog",
    "access": "member",
    "source_component": "MyBlog"
  },
  {
    "path": "/devices",
    "title": "Connected devices",
    "access": "member",
    "source_component": "ConnectedDevices"
  },
  {
    "path": "/connections",
    "title": "Connections",
    "access": "member",
    "source_component": "Connections"
  },
  {
    "path": "/inbox",
    "title": "Inbox",
    "access": "member",
    "source_component": "Inbox"
  },
  {
    "path": "/following",
    "title": "Following",
    "access": "member",
    "source_component": "FollowedCampaigns"
  },
  {
    "path": "/notifications",
    "title": "Notifications",
    "access": "member",
    "source_component": "Notifications"
  },
  {
    "path": "/donors",
    "title": "Supporters",
    "access": "member",
    "source_component": "Donors"
  },
  {
    "path": "/ledger",
    "title": "Financial ledger",
    "access": "member",
    "source_component": "FinancialLedger"
  },
  {
    "path": "/subscriptions",
    "title": "Plans",
    "access": "member",
    "source_component": "Subscriptions"
  },
  {
    "path": "/withdrawals",
    "title": "Withdrawals",
    "access": "member",
    "source_component": "Withdrawals"
  },
  {
    "path": "/agents",
    "title": "AI team",
    "access": "member",
    "source_component": "Agents"
  },
  {
    "path": "/ops",
    "title": "Ops Center",
    "access": "admin",
    "source_component": "OpsCenter"
  },
  {
    "path": "/platform",
    "title": "Platform",
    "access": "admin",
    "source_component": "Platform"
  },
  {
    "path": "/analytics",
    "title": "Command Center",
    "access": "admin",
    "source_component": "Analytics"
  },
  {
    "path": "/connect",
    "title": "Admin integrations redirect",
    "access": "admin",
    "source_component": "Navigate"
  },
  {
    "path": "/admin/external-accounts",
    "title": "External accounts",
    "access": "admin",
    "source_component": "ExternalAccounts"
  },
  {
    "path": "/admin/integrations",
    "title": "Admin integrations",
    "access": "admin",
    "source_component": "IntegrationsAdmin"
  },
  {
    "path": "/admin/audit",
    "title": "Audit log",
    "access": "admin",
    "source_component": "AuditLogAdmin"
  },
  {
    "path": "/admin/agent-api",
    "title": "Agent API",
    "access": "admin",
    "source_component": "AdminAgentApi"
  },
  {
    "path": "/admin/sustainability",
    "title": "Planet Impact",
    "access": "admin",
    "source_component": "SustainabilityAdmin"
  },
  {
    "path": "/admin/help",
    "title": "Help Center editor",
    "access": "admin",
    "source_component": "HelpAdmin"
  },
  {
    "path": "/admin/founding-members",
    "title": "Founding members admin",
    "access": "admin",
    "source_component": "AdminFoundingWaitlist"
  }
]);
export const routeByPath = (path) => HISTORICAL_ROUTES.find(page => page.path === path);
