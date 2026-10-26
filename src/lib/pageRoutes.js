// Derived from the 58 source routes in read-only interplanetary-fund2/src/App.jsx.
// A routed screen alone never establishes functional backend parity.
const rows = `/login|Sign in|public|existing
/register|Create an account|public|registration
/forgot-password|Recover account|public|recovery
/reset-password|Reset password|public|reset
/globe|Global Globe|public|globe
/embed/campaign/:id|Embedded campaign|public|embed
/oauth/consent|Authorize integration|public|restricted
/activate|Activate device|public|restricted
/|Home|public|existing
/about|About|public|existing
/founding-members|Founding members|public|founding
/terms|Terms of Service|public|existing
/privacy|Privacy Policy|public|existing
/contact|Contact|public|contact
/admin/organization-mail|Organization mail|admin|admin
/discover|Discover campaigns|public|existing
/campaign/:id|Campaign|public|existing
/community|Community|public|existing
/community/:id|Community discussion|public|post
/u/:id|Member profile|public|public-profile
/social|IFund Social|public|social
/blogs|Stories & Blogs|public|library
/blogs/:id|Story|public|article
/publications/:id|Publication|public|article
/help|Help Center|public|help
/help/:slug|Help article|public|help-article
/onboarding|Get started|member|onboarding
/dashboard|Dashboard|member|dashboard
/create|New campaign|member|existing
/giving|My Giving|member|financial
/communications|Communications|member|messaging
/mission|Mission Control|member|tools
/ai-images|AI Image Studio|member|tools
/institutions|Institutions|member|library
/institutions/:id|Institution|member|article
/profile|Profile|member|profile
/my-blog|My Blog|member|messaging
/devices|Connected devices|member|devices
/connections|Connections|member|existing
/inbox|Inbox|member|messaging
/following|Following|member|library
/notifications|Notifications|member|messaging
/donors|Supporters|member|financial
/ledger|Financial ledger|member|financial
/subscriptions|Plans|member|financial
/withdrawals|Withdrawals|member|financial
/agents|AI team|member|tools
/ops|Ops Center|admin|admin
/platform|Platform|admin|admin
/analytics|Command Center|admin|admin
/connect|Admin integrations redirect|admin|redirect
/admin/external-accounts|External accounts|admin|admin
/admin/integrations|Admin integrations|admin|admin
/admin/audit|Audit log|admin|admin
/admin/agent-api|Agent API|admin|admin
/admin/sustainability|Planet Impact|admin|admin
/admin/help|Help Center editor|admin|admin
/admin/founding-members|Founding members admin|admin|admin`;
export const sourcePageRoutes = rows
  .trim()
  .split("\n")
  .map((line) => {
    const [path, title, access, kind] = line.split("|");
    return { path, title, access, kind };
  });
export const sourceRoutePaths = new Set(
  sourcePageRoutes.map((page) => page.path),
);
export const sourceRouteCount = sourcePageRoutes.length;
export const findPage = (path) =>
  sourcePageRoutes.find((page) => page.path === path);
export const existingIndependentPagePaths = new Set([
  "/login",
  "/",
  "/about",
  "/terms",
  "/privacy",
  "/discover",
  "/campaign/:id",
  "/community",
  "/create",
  "/connections",
]);
