import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { authClient } from "@/api/auth";

// UI gate only; every privileged data/API operation must ALSO check auth on
// the server with RLS and role permissions. Never trust browser role state.
export default function RequireAccess({ access = "member", children }) {
  const location = useLocation();
  const [state, setState] = useState({ phase: "loading", user: null });
  useEffect(() => {
    if (access === "public") return;
    let mounted = true;
    let subscription;
    try {
      const client = authClient();
      client.auth.getUser()
        .then(({ data, error }) => {
          if (mounted) setState(error ? { phase: "error", user: null } :
            { phase: "ready", user: data?.user || null });
        })
        .catch(() => { if (mounted) setState({ phase: "error", user: null }); });
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT" && mounted) setState({ phase: "ready", user: null });
      });
      subscription = data?.subscription;
    } catch {
      if (mounted) setState({ phase: "error", user: null });
    }
    return () => { mounted = false; subscription?.unsubscribe(); };
  }, [access]);
  if (access === "public") return children;
  if (state.phase === "loading") return <main role="status" className="mx-auto max-w-3xl p-8">Verifying account access…</main>;
  if (state.phase === "error") return <main role="alert" className="mx-auto max-w-3xl p-8">Account verification is unavailable. No protected information was loaded.</main>;
  if (!state.user) {
    const returnTo = location.pathname + location.search + location.hash;
    return <Navigate replace to={"/login?returnTo=" + encodeURIComponent(returnTo)} />;
  }
  if (access === "admin" || access === "specially protected administration") {
    const role = state.user.app_metadata?.role;
    if (role !== "admin" && role !== "super_admin") {
      return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-semibold">Access restricted</h1><p>This page requires independently verified administrative permissions.</p><Link to="/dashboard" className="underline">Dashboard</Link></main>;
    }
  }
  return children;
}
