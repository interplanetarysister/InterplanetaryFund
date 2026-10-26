// Original route labels and section order are derived from the read-only
// interplanetary-fund2/src/components/Layout.jsx (2026-10-26).
// An unavailable destination remains visible but cannot navigate to a stub.
const item = (label, path, ready = false) => ({ label, path, ready });
export const publicNavigation = [
  item("Home", "/", true),
  item("Discover", "/discover", true),
  item("Community", "/community", true),
  item("IFund Social", "/social"),
  item("Global Globe", "/globe"),
  item("Stories & Blogs", "/blogs"),
  item("Help Center", "/help"),
];
export const memberNavigation = [
  { label: "Explore", items: [
    item("Dashboard", "/dashboard"),
    item("Discover", "/discover", true),
    item("Global Globe", "/globe"),
  ] },
  { label: "Campaigns & Giving", items: [
    item("New Campaign", "/create", true),
    item("My Campaigns", "/mine", true),
    item("Supporters", "/donors"),
    item("My Giving", "/giving"),
    item("Following", "/following"),
    item("Withdrawals", "/withdrawals"),
    item("Financial Ledger", "/ledger"),
  ] },
  { label: "Community", items: [
    item("IFund Social", "/social"),
    item("Community", "/community", true),
    item("Stories & Blogs", "/blogs"),
    item("My Blog", "/my-blog"),
    item("Institutions", "/institutions"),
    item("Messages", "/communications"),
    item("Inbox", "/inbox"),
  ] },
  { label: "AI Tools", items: [
    item("AI Team", "/agents"),
    item("Mission Control", "/mission"),
    item("AI Image Studio", "/ai-images"),
  ] },
  { label: "Account & Help", items: [
    item("Account", "/login", true),
    item("Connections", "/connections", true),
    item("Plans", "/subscriptions"),
    item("Help Center", "/help"),
  ] },
];
export const adminNavigation = { label: "Administration", items: [
  item("Ops Center", "/ops"),
  item("Command Center", "/analytics"),
  item("Platform", "/platform"),
  item("Admin Integrations", "/admin/integrations"),
  item("Audit Log", "/admin/audit"),
  item("Planet Impact", "/admin/sustainability"),
  item("Help Center Editor", "/admin/help"),
  item("Founding Members", "/admin/founding-members"),
] };
// Visibility is not authorization. Any restored API/page must enforce its
// own server-side role and ownership policy before its ready flag is enabled.
export function navigationFor({ signedIn = false, role = null } = {}) {
  if (!signedIn) return [{ label: "Explore", items: publicNavigation }];
  return role === "admin" || role === "super_admin"
    ? [...memberNavigation, adminNavigation]
    : memberNavigation;
}
export const readyRoutes = new Set([
  "/", "/discover", "/community", "/connections", "/create", "/mine", "/login",
]);
export function isNavigationReady(item) {
  return item.ready === true && readyRoutes.has(item.path);
}
