import { Link, useLocation } from "react-router-dom";
import { needsLayoutMainLandmark } from "@/lib/routeMainLandmark.mjs";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useAdminAccess } from "@/hooks/useAdminAccess";

export default function AdminAccess({ children }) {
  const { pathname } = useLocation();
  const Gate = needsLayoutMainLandmark(pathname) ? "div" : "main";
  const { status: sessionStatus, user } = useAuthSession();
  const adminStatus = useAdminAccess(user);
  if (sessionStatus === "loading" || adminStatus === "loading") {
    return <Gate role="status" className="mx-auto max-w-3xl p-8">Checking administrator access…</Gate>;
  }
  if (!user) {
    return <Gate className="mx-auto max-w-3xl space-y-3 p-8"><h1 className="text-2xl font-semibold">Sign in required</h1><Link className="underline" to="/login">Sign in to continue</Link></Gate>;
  }
  if (adminStatus !== "admin") {
    return <Gate role="alert" className="mx-auto max-w-3xl space-y-3 p-8"><h1 className="text-2xl font-semibold">Administrator access unavailable</h1><p>{adminStatus === "unavailable" ? "We could not verify your administrator permissions. No access was granted." : "This area is available to verified IFund administrators only."}</p><Link className="underline" to="/help">Get help</Link></Gate>;
  }
  return children;
}
