import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSuperAdminAccess } from "@/hooks/useSuperAdminAccess";

export default function SuperAdminAccess({ children }) {
  const { status: sessionStatus, user } = useAuthSession();
  const accessStatus = useSuperAdminAccess(user);
  if (sessionStatus === "loading" || accessStatus === "loading") {
    return <main role="status" className="mx-auto max-w-3xl p-8">Checking super-administrator access…</main>;
  }
  if (!user) {
    return <main className="mx-auto max-w-3xl space-y-3 p-8"><h1 className="text-2xl font-semibold">Sign in required</h1><Link className="underline" to="/login">Sign in to continue</Link></main>;
  }
  if (accessStatus !== "super-admin") {
    return <main role="alert" className="mx-auto max-w-3xl space-y-3 p-8"><h1 className="text-2xl font-semibold">Super-administrator access unavailable</h1><p>{accessStatus === "unavailable" ? "We could not verify super-administrator permissions. No access was granted." : "Website Studio is restricted to the verified IFund super-administrator."}</p><Link className="underline" to="/help">Get help</Link></main>;
  }
  return children;
}
