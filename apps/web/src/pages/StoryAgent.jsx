import { useEffect, useRef, useState } from "react";
import { authClient } from "@/api/auth";

export default function StoryAgent() {
  const [details, setDetails] = useState("");
  const [section, setSection] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestRef = useRef(null);
  async function api(path, body) {
    const client = authClient();
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token)
      throw Error("Sign in to use your writing assistant.");
    const res = await fetch("/api/agents/story/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + data.session.access_token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(90000),
    });
    let result;
    try {
      result = await res.json();
    } catch {
      throw Error(
        "The writing assistant is not available yet. Your text is safe.",
      );
    }
    if (!res.ok)
      throw Object.assign(
        Error(
          result.error || "Your draft could not be prepared. Please try again.",
        ),
        { code: result.code },
      );
    return result;
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api("drafts"),
      (async () => {
        const client = authClient();
        const {
          data: { user },
          error,
        } = await client.auth.getUser();
        if (error || !user) throw Error("Please sign in again.");
        const result = await client
          .from("ifund_campaigns")
          .select("id,title")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(50);
        if (result.error) throw Error("Your campaigns could not be loaded.");
        return result.data;
      })(),
    ])
      .then(([result, owned]) => {
        if (active) {
          setDrafts(result.drafts);
          setCampaigns(owned);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function generate(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const input = {
      details,
      campaign_id: campaignId || null,
      section: section || null,
    };
    const fingerprint = JSON.stringify(input);
    if (requestRef.current?.fingerprint !== fingerprint)
      requestRef.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await api("drafts", {
        ...input,
        request_id: requestRef.current.id,
      });
      setDrafts((current) => [
        result.draft,
        ...current.filter((d) => d.id !== result.draft.id),
      ]);
      setNotice(
        "Your private suggestion is saved below. Review it before using any text.",
      );
      requestRef.current = null;
    } catch (err) {
      if (err.code === "new_request_required") requestRef.current = null;
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(id) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("cancel", { draft_id: id });
      setDrafts((current) =>
        current.map((d) => (d.id === id ? { ...d, status: "cancelled" } : d)),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-3xl space-y-7 p-4 pb-24 sm:p-7">
      <header>
        <h1 className="text-3xl font-semibold">Your writing assistant</h1>
        <p className="mt-3 text-muted-foreground">
          Tell your campaign’s story in your own voice. Suggestions are private
          and saved for your review.
        </p>
      </header>
      {loading && <p role="status">Loading your drafts…</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-destructive p-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border p-4">
          {notice}
        </p>
      )}
      <form onSubmit={generate} className="space-y-5 rounded-2xl border p-5">
        <label className="block">
          Campaign (optional)
          <select
            disabled={busy || loading}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-3"
          >
            <option value="">Start a new campaign idea</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || "Untitled campaign"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          What should people know?
          <textarea
            required
            minLength={12}
            maxLength={4000}
            rows={6}
            disabled={busy}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="mt-2 w-full rounded-xl border bg-background p-3"
          />
          <span className="mt-1 block text-sm text-muted-foreground">
            Include the real need, who benefits, your preferred tone, and
            anything that must stay unchanged.
          </span>
        </label>
        <label className="block">
          Rewrite one story section (optional)
          <textarea
            maxLength={4000}
            rows={4}
            disabled={busy}
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="mt-2 w-full rounded-xl border bg-background p-3"
          />
        </label>
        <button
          disabled={busy || loading || details.trim().length < 12}
          className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy
            ? "Preparing your draft…"
            : section.trim()
              ? "Suggest a section rewrite"
              : "Suggest titles, summaries and a story"}
        </button>
      </form>
      <section className="space-y-5">
        <h2 className="text-2xl font-semibold">Your saved suggestions</h2>
        {!loading && drafts.length === 0 && <p>No saved suggestions yet.</p>}
        {drafts.map((d) => (
          <article key={d.id} className="space-y-4 rounded-2xl border p-5">
            <p className="text-sm text-muted-foreground">
              {d.status === "cancelled"
                ? "Cancelled suggestion"
                : "Private suggestion · review before using"}
            </p>
            {d.payload?.titles && (
              <div>
                <h3 className="font-semibold">Title ideas</h3>
                <ul className="list-disc space-y-2 pl-5">
                  {d.payload.titles.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
            {d.payload?.summaries && (
              <div>
                <h3 className="font-semibold">Summary ideas</h3>
                {d.payload.summaries.map((text, i) => (
                  <p className="mt-2" key={i}>
                    {text}
                  </p>
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap break-words">
              {d.payload?.section || d.payload?.story}
            </p>
            {d.payload?.image_prompt && (
              <details>
                <summary className="min-h-11 cursor-pointer">
                  Suggested visual direction
                </summary>
                <p>{d.payload.image_prompt}</p>
              </details>
            )}
            {d.status === "draft" && (
              <button
                disabled={busy}
                onClick={() => cancel(d.id)}
                className="min-h-11 underline disabled:opacity-50"
              >
                Cancel this suggestion
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
