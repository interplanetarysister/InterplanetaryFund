import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";

/**
 * Self-service session controls. The Supabase browser SDK exposes the current
 * session, not a complete trusted inventory of every device: never fabricate
 * a list of sessions or assert that remote access tokens expire instantly.
 */
export default function Devices() {
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: "loading", email: "", expires: null, error: "" });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ phase: "loading", email: "", expires: null, error: "" });
    (async () => {
      const client = authClient();
      const [{ data: identity, error: identityError }, { data: sessionData, error: sessionError }] = await Promise.all([
        client.auth.getUser(), client.auth.getSession(),
      ]);
      if (identityError || sessionError || !identity?.user?.id ||
          identity.user.id !== sessionData?.session?.user?.id ||
          !sessionData.session.access_token) {
        throw new Error("Your active account session could not be verified.");
      }
      if (active) setState({
        phase: "ready",
        email: identity.user.email || "",
        expires: sessionData.session.expires_at || null,
        error: "",
      });
    })().catch(cause => {
      if (active) setState({ phase: "error", email: "", expires: null,
        error: cause?.message || "Session information could not be loaded." });
    });
    return () => { active = false; };
  }, [revision]);

  async function signOut(scope) {
    if (busy || state.phase !== "ready") return;
    setBusy(scope); setNotice("");
    try {
      const { error } = await authClient().auth.signOut({ scope });
      if (error) throw error;
      if (scope === "local") {
        navigate("/login", { replace: true });
        return;
      }
      setNotice("Other refresh sessions were revoked. An existing access token may remain valid until its expiration. Your current session is still open.");
      setRevision(n => n + 1);
    } catch (cause) {
      setNotice(cause?.message || "The sign-out operation could not be verified.");
    } finally { setBusy(""); }
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Connected devices and sessions</h1>
      <p className="text-sm text-muted-foreground">Manage your current session and revoke refresh sessions on other devices. This page does not claim to display an exhaustive device inventory.</p>
    </header>
    {state.phase === "loading" && <p role="status">Checking the current account session…</p>}
    {state.phase === "error" && <section role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-5">
      <p>{state.error}</p>
      <button type="button" onClick={() => setRevision(n => n + 1)} className="min-h-11 rounded-xl border px-4">Retry session check</button>
    </section>}
    {state.phase === "ready" && <>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">This browser</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Signed in as</dt><dd className="break-all font-medium">{state.email || "Verified member"}</dd></div>
          <div><dt className="text-muted-foreground">Access-token expiration</dt><dd className="font-medium">{Number.isFinite(Number(state.expires)) && Number(state.expires) > 0 ? new Date(Number(state.expires) * 1000).toLocaleString() : "Not available"}</dd></div>
        </dl>
        <button type="button" disabled={Boolean(busy)} onClick={() => signOut("local")}
          className="min-h-11 rounded-xl border border-border px-4 font-semibold disabled:opacity-60">
          {busy === "local" ? "Signing out…" : "Sign out on this browser"}
        </button>
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Other sessions</h2>
        <p className="text-sm text-muted-foreground">Revoking other sessions prevents reuse of their refresh tokens. Already issued access tokens can remain valid until they expire. This does not disconnect accounts you authorized on other platforms.</p>
        <button type="button" disabled={Boolean(busy)} onClick={() => signOut("others")}
          className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
          {busy === "others" ? "Revoking sessions…" : "Sign out other sessions"}
        </button>
      </section>
      {notice && <p role="status" className="rounded-xl border border-border p-4 text-sm">{notice}</p>}
      <Link className="inline-flex min-h-11 items-center text-primary underline" to="/profile">Back to profile settings</Link>
    </>}
  </main>;
}
