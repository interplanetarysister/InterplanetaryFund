import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { changeMyMembership, getMyMembership, getPublicCommunity } from "@/api/communityGroups";

export default function CommunityDetail() {
  const { id } = useParams();
  const { user } = useAuthSession();
  const [group, setGroup] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [membership, setMembership] = useState(false);
  const [memberStatus, setMemberStatus] = useState("unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    setPhase("loading"); setGroup(null); setError(""); setNotice("");
    getPublicCommunity(id).then(result => {
      if (!alive) return;
      setGroup(result);
      setPhase(result ? "ready" : "not-found");
    }).catch(cause => {
      if (alive) {
        setPhase("error");
        setError(cause?.message || "This community could not be loaded.");
      }
    });
    return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    let alive = true;
    setMembership(false);
    if (!group || !user || user.is_anonymous) {
      setMemberStatus("sign-in");
      return () => { alive = false; };
    }
    setMemberStatus("loading");
    getMyMembership(group.id).then(joined => {
      if (alive) { setMembership(joined); setMemberStatus("ready"); }
    }).catch(() => { if (alive) setMemberStatus("error"); });
    return () => { alive = false; };
  }, [group?.id, user?.id]);

  async function toggle() {
    if (busy || !group || memberStatus !== "ready") return;
    setBusy(true); setError(""); setNotice("");
    try {
      const verified = await changeMyMembership(group.id, !membership);
      setMembership(verified);
      setNotice(verified ? "You joined this community." : "You left this community.");
    } catch (cause) {
      setError(cause?.message || "Your membership could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
    <Link to="/community" className="inline-flex min-h-11 items-center text-cyan-600 underline">Back to community groups</Link>
    {phase === "loading" && <p role="status">Loading community…</p>}
    {phase === "not-found" && <section className="rounded-2xl border border-border bg-card p-6">
      <h1 className="text-2xl font-bold">Community unavailable</h1>
      <p className="mt-2 text-muted-foreground">This group was not found or has been archived. Private or unverified legacy groups are not made public.</p>
    </section>}
    {phase === "error" && <p role="alert">{error}</p>}
    {phase === "ready" && <article className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Interplanetary Fund community</p>
        <h1 className="mt-2 text-3xl font-bold">{group.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{group.location || "Worldwide"}</p>
      </header>
      <section aria-label="About this community" className="space-y-2">
        <h2 className="text-lg font-semibold">About this group</h2>
        <p className="whitespace-pre-wrap leading-relaxed">{group.description}</p>
      </section>
      <div className="border-t border-border pt-4">
        {user && !user.is_anonymous ? <div className="flex flex-wrap gap-3">
          {memberStatus === "ready"
            ? <button type="button" disabled={busy} onClick={toggle}
                className="min-h-11 rounded-xl bg-cyan-600 px-5 font-semibold text-white disabled:opacity-60">
                {busy ? "Verifying…" : membership ? "Leave community" : "Join community"}
              </button>
            : <span role="status" className="text-sm text-muted-foreground">
                {memberStatus === "loading" ? "Checking your membership…" : "Membership verification is unavailable."}
              </span>}
        </div> : <Link to="/register?returnTo=%2Fcommunity" className="inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-4 font-semibold text-white">
          Sign in to join community
        </Link>}
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-emerald-600">{notice}</p>}
        <p className="mt-4 text-sm text-muted-foreground">Members can participate in the public IFund discussion feed. Group-specific posting is not yet connected, so conversations there are visible to all feed visitors.</p>
        <Link to="/social" className="mt-2 inline-flex min-h-11 items-center text-cyan-600 underline">Browse public discussions</Link>
      </div>
    </article>}
  </main>;
}
