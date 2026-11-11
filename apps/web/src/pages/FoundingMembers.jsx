import { Navigate, useLocation } from "react-router-dom";

// Retain legacy links without maintaining a second registration or waitlist.
export default function FoundingMembers() {
  const location = useLocation();
  const returnTo = new URLSearchParams(location.search).get("returnTo");
  const query = returnTo ? "?returnTo=" + encodeURIComponent(returnTo) : "";
  return <Navigate to={"/register" + query} replace />;
}
