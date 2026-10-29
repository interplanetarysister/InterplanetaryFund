import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

export default function FoundingMembers({ user }) {
  const [joined, setJoined] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoaded(false); setError(""); setNotice("");
    if (!db || !user?.id) { setLoaded(true); return; }
    db.from("ifund_founding_members").select("member_id,joined_at")
      .eq("member_id", user.id).maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError(loadError.message);
        setJoined(Boolean(data)); setDate(data?.joined_at || ""); setLoaded(true);
      }).catch((cause) => {
        if (cancelled) return;
        setLoaded(true); setError(cause?.message || "Unable to read founding membership.");
      });
    return () => { cancelled = true; };
  }, [user?.id]);
  async function changeMembership(join) {
    if (!db || !user?.id || !loaded || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const query = join
        ? db.from("ifund_founding_members").insert({ member_id: user.id })
        : db.from("ifund_founding_members").delete().eq("member_id", user.id);
      const { data, error: saveError } = await query.select("member_id,joined_at");
      if (saveError) throw saveError;
      if (!data?.length) throw new Error("Membership change was not verified.");
      setJoined(join);
      setDate(join ? data[0].joined_at : "");
      setNotice(join ? "Welcome to the founding community." : "You have left the founding community.");
    } catch (cause) {
      setError(cause?.message || "Your membership could not be changed.");
    } finally { setBusy(false); lock.current = false; }
  }
  return <main className="founding-members">
    <div className="hero">
      <p className="eyebrow">WHAT IF YOU WERE HERE FROM THE BEGINNING?</p>
      <h1>Be part of the founding community</h1>
      <p>Help shape a fundraising universe built around people, causes, and endless possibilities.</p>
    </div>
    <section className="card">
      <h2>Founding member benefits</h2>
      <p>Explore IFund as it develops, participate in the community, and share suggestions for features you want to see.</p>
      <p>Joining is free. It is not a paid subscription, investment, priority placement, or promise of future rewards.</p>
    </section>
    <section className="card">
      <h2>Your membership</h2>
      {user ? <>
        {!loaded ? <Loading /> : <><p role="status">{joined
          ? "You are part of the founding community."
          : "You have not joined the founding community yet."}</p>
          {joined && date && <p><small>{"Joined " + new Date(date).toLocaleDateString()}</small></p>}
          <button type="button" className={joined ? "secondary" : "primary"}
            disabled={busy || Boolean(error)} onClick={() => changeMembership(!joined)}>
            {busy ? "Saving…" : joined ? "Leave founding community" : "Join for free"}
          </button></>}
      </> : <>
        <p>Sign in to join the founding community with your IFund account.</p>
        <Link className="primary" to="/login?returnTo=%2Ffounding-members">Sign in to join</Link>
      </>}
      <Message error={Boolean(error)}>{error || notice}</Message>
    </section>
    <div className="actions">
      <Link className="secondary" to="/social">Visit the community</Link>
      <Link className="secondary" to="/about">About Interplanetary Fund</Link>
    </div>
  </main>;
}
