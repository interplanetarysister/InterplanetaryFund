import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/supabase";
function Detail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, record: null, error: "" });
  useEffect(() => {
    let active = true;
    if (!db || !/^[0-9a-f-]{36}$/i.test(id || "")) {
      setState({ loading: false, record: null, error: "An independently verified campaign is not available at this address." });
      return;
    }
    setState({ loading: true, record: null, error: "" });
    db.from("ifund_campaigns").select("*").eq("id", id).maybeSingle()
      .then(({ data, error }) => {
        if (active) setState({ loading: false, record: data || null, error: error ? "Campaign could not be verified." : "" });
      })
      .catch(() => {
        if (active) setState({ loading: false, record: null, error: "Campaign service is unavailable." });
      });
    return () => { active = false; };
  }, [id]);
  const c = state.record;
  return <main className="stack">
    {state.loading ? <p role="status">Loading campaign…</p> : state.error ? <p role="alert">{state.error}</p> : !c ? <p>This campaign is not published in the independent app.</p> :
      <article className="detail">
        <small>{c.category} · {c.status}</small><h1>{c.title}</h1>
        {c.cover_image_url && <img className="cover" src={c.cover_image_url} alt="Campaign cover" />}
        <p className="lede">{c.summary}</p>
        <div className="card"><h2>Funding goal</h2>
          <strong>{Number(c.goal_amount || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}</strong>
          <p>Donations are disabled until PayPal merchant identity, the ledger and provider webhooks are verified.</p></div>
        <p className="story">{c.story}</p>
      </article>}
    <Link to="/discover">Discover campaigns</Link>
  </main>;
}
export default Detail;
