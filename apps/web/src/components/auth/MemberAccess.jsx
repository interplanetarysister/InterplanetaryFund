import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { payoutIdentity } from "@/lib/guestAccess";
import { TERMS_VERSION } from "@/lib/legalPolicy";

// Client gating is UX only: the Supabase RLS policies remain authoritative.
// Never infer acceptance from a checkbox toggle, metadata or an auth session.
export default function MemberAccess({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ phase: "loading", user: null });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const identityRevision = useRef(0);
  const observedIdentity = useRef(null);
  useEffect(() => {
    let alive = true;
    setState({ phase: "loading", user: null });
    setAgreed(false);
    setError("");
    let auth;
    try {
      auth = authClient();
    } catch {
      setState({ phase: "error", user: null });
      return () => {
        alive = false;
      };
    }
    async function verify() {
      const revision = ++identityRevision.current;
      const current = () => alive && revision === identityRevision.current;
      setState({ phase: "loading", user: null });
      setAgreed(false);
      setError("");
      try {
        const { data, error: authError } = await auth.auth.getUser();
        if (authError || !payoutIdentity(data?.user)) {
          if (current()) setState({ phase: "login", user: null });
          return;
        }
        const user = data.user;
        if (!current()) return;
        observedIdentity.current = user.id;
        const { data: profile, error: profileError } = await auth
          .from("ifund_profiles")
          .select("id,account_status,account_deletion_pending")
          .eq("id", user.id)
          .maybeSingle();
        if (
          profileError ||
          !profile ||
          profile.account_status !== "active" ||
          profile.account_deletion_pending !== false
        ) {
          if (current()) setState({ phase: "error", user: null });
          return;
        }
        const { data: acceptance, error: legalError } = await auth
          .from("ifund_legal_acceptances")
          .select("owner_id,terms_version,explicit_consent")
          .eq("owner_id", user.id)
          .eq("terms_version", TERMS_VERSION)
          .maybeSingle();
        if (legalError) throw legalError;
        if (current())
          setState({
            phase: acceptance?.explicit_consent === true ? "ready" : "consent",
            user,
          });
      } catch {
        if (current()) setState({ phase: "error", user: null });
      }
    }
    verify();
    const { data: sub } = auth.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      const nextIdentity = payoutIdentity(session?.user)
        ? session.user.id
        : null;
      // Token refresh and tab focus can emit SIGNED_IN for the same identity.
      // Preserve that member's unsaved forms; RLS still checks every operation.
      if (nextIdentity && observedIdentity.current === nextIdentity) return;
      observedIdentity.current = nextIdentity;
      // Invalidate pending reads immediately. Defer SDK calls until its auth
      // callback lock is released. Children unmount before another identity loads.
      identityRevision.current++;
      setState({ phase: !nextIdentity ? "login" : "loading", user: null });
      setAgreed(false);
      setError("");
      if (nextIdentity)
        queueMicrotask(() => {
          if (alive) verify();
        });
    });
    return () => {
      alive = false;
      identityRevision.current++;
      sub.subscription?.unsubscribe();
    };
  }, []);

  async function accept(event) {
    event.preventDefault();
    if (!agreed || busy || state.phase !== "consent" || !state.user?.id) return;
    setBusy(true);
    setError("");
    const revision = identityRevision.current;
    try {
      const client = authClient();
      const { error: insertError } = await client
        .from("ifund_legal_acceptances")
        .insert({
          owner_id: state.user.id,
          terms_version: TERMS_VERSION,
          explicit_consent: true,
        });
      if (insertError && insertError.code !== "23505") throw insertError;
      const { data, error: checkError } = await client
        .from("ifund_legal_acceptances")
        .select("owner_id,terms_version,explicit_consent")
        .eq("owner_id", state.user.id)
        .eq("terms_version", TERMS_VERSION)
        .maybeSingle();
      if (
        checkError ||
        data?.owner_id !== state.user.id ||
        data?.explicit_consent !== true
      )
        throw new Error("Consent not confirmed");
      if (revision === identityRevision.current)
        setState((current) =>
          current.user?.id === data.owner_id
            ? { phase: "ready", user: current.user }
            : current,
        );
    } catch {
      if (revision === identityRevision.current)
        setError(
          "We could not confirm your agreement. No access has been granted. Please try again.",
        );
    } finally {
      setBusy(false);
    }
  }
  const requested = location.pathname + location.search + location.hash;
  const loginTarget =
    "/register?returnTo=" + encodeURIComponent(safeReturnTo(requested));
  if (state.phase === "ready")
    return <Fragment key={state.user.id}>{children}</Fragment>;
  if (state.phase === "loading")
    return (
      <main role="status" className="mx-auto max-w-2xl p-8">
        Verifying account access…
      </main>
    );
  if (state.phase === "login")
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">Register an email account to create content</h1>
        <p>Anonymous visitors can browse freely. Creating campaigns, posting, or saving private account content requires confirmed email signup. Two-factor authentication is not required here; it is requested before the first withdrawal.</p>
        <Link to={loginTarget} className="underline">
          Create an email account
        </Link>
      </main>
    );
  if (state.phase === "error")
    return (
      <main role="alert" className="mx-auto max-w-2xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">
          Account verification unavailable
        </h1>
        <p>
          We could not verify your account status and permissions. No changes
          were made.
        </p>
        <Link to="/help" className="underline">
          Get help
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 py-10">
      <h1 className="text-3xl font-semibold">Review the member agreement</h1>
      <p>
        Before accessing private fundraising tools, please review the current
        legal documents. Agreement is voluntary and never automatic.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link
          to="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Terms of Service
        </Link>
        <Link
          to="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Privacy Policy
        </Link>
      </div>
      <p className="text-sm">Agreement version: {TERMS_VERSION}</p>
      <form
        onSubmit={accept}
        className="space-y-5 rounded-xl border border-border p-5"
      >
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
            className="mt-1 h-5 w-5"
          />
          <span>
            I agree to the Terms of Service and acknowledge the Privacy Policy
            for the version listed above.
          </span>
        </label>
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!agreed || busy}
          className="min-h-11 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Confirming…" : "Agree and continue"}
        </button>
      </form>
    </main>
  );
}
