import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { helpArticles } from "@/lib/helpArticles";
import { helpStudioAnswer, helpStudioPayload, helpStudioSlug } from "@/lib/studioHelpContent.mjs";

const action = "min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50";

/** Edit published Help answers using the already-audited super-admin Studio.
 * Never claim a change reached the public site without an authorized Studio
 * response. Only approved bundled article slugs can be overridden.
 */
export default function AdminHelpEditor() {
  const [pages, setPages] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(helpArticles[0]?.slug || "");
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const api = useCallback(async (path, method = "GET", body, ifMatch = null) => {
    const db = authClient();
    const before = await db.auth.getUser();
    const { data: session, error: sessionError } = await db.auth.getSession();
    if (sessionError || before.error || !before.data?.user?.id ||
        before.data.user.id !== session?.session?.user?.id ||
        !session.session.access_token)
      throw new Error("Your administrator session could not be verified.");
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: "Bearer " + session.session.access_token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(ifMatch ? { "If-Match": ifMatch } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error("Help Center Studio request was not accepted (" + response.status + ").");
    const after = await db.auth.getUser();
    if (after.error || after.data?.user?.id !== before.data.user.id)
      throw new Error("Your account changed. Reload the Help Center editor.");
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    setPhase("loading"); setError(""); setNotice("");
    (async () => {
      const found = [];
      // The Studio list endpoint is paginated, never assume the first 100
      // records contain every saved Help article. Fail closed above 1,000.
      for (let offset = 0; offset <= 900; offset += 100) {
        const rows = await api("/api/studio/pages?limit=100&offset=" + offset);
        if (!Array.isArray(rows) || rows.length > 100)
          throw new Error("Studio returned an invalid page listing.");
        found.push(...rows);
        if (rows.length < 100) {
          if (active) { setPages(found); setDrafts({}); setPhase("ready"); }
          return;
        }
      }
      throw new Error("The Studio page list is too large for this editor. Open Website Studio.");
    })().catch(cause => { if (active) { setPhase("error"); setError(cause.message || "Help Center articles unavailable."); } });
    return () => { active = false; };
  }, [api, reload]);

  const article = useMemo(() => helpArticles.find(item => item.slug === selected), [selected]);
  const page = useMemo(() => pages.find(item => item.slug === helpStudioSlug(selected)), [pages, selected]);
  const original = article ? helpStudioAnswer(page, article.slug, { requirePublished: false }) || article.answer : "";
  const answer = Object.prototype.hasOwnProperty.call(drafts, selected) ? drafts[selected] : original;
  const changed = answer.trim() !== original.trim();

  async function save(status) {
    if (!article || busy || phase !== "ready") return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (status === "draft" && page?.status === "published")
        throw new Error("This answer is published. Publish your revision when ready; saving a draft would unpublish the current answer.");
      const payload = helpStudioPayload(article, answer, status);
      if (page?.id && !page.updated_at)
        throw new Error("The published article revision could not be verified. Reload before editing.");
      const updated = page?.id
        ? await api("/api/studio/pages/" + encodeURIComponent(page.id), "PATCH", payload, page.updated_at)
        : await api("/api/studio/pages", "POST", payload);
      if (!updated || updated.slug !== payload.slug || updated.status !== status ||
          !updated.id || !updated.updated_at ||
          helpStudioAnswer(updated, article.slug, { requirePublished: false }) !== payload.content.blocks[0].body)
        throw new Error("The Help Center response could not be verified. Reload to check the saved version.");
      setPages(current => [updated, ...current.filter(item => item.id !== updated.id)]);
      setDrafts(current => {
        const next = { ...current };
        delete next[article.slug];
        return next;
      });
      setNotice(status === "published"
        ? "The updated Help Center answer was published by Website Studio."
        : "Private Help Center draft saved; the public article has not changed.");
    } catch (cause) {
      setError(cause?.message || "The Help Center article could not be saved.");
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold">Help Center editor</h1>
      <p className="text-sm text-muted-foreground">Edit the answers for existing public help topics. Drafts stay private until you publish. Website Studio records each authorized revision and enforces super-admin access.</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link to="/help" className="text-primary underline">Public Help Center</Link>
        <Link to="/admin/studio" className="text-primary underline">Website Studio and version history</Link>
        <Link to="/support" className="text-primary underline">Support cases</Link>
      </div>
    </header>
    {phase === "loading" && <p role="status">Loading protected Help Center articles…</p>}
    {error && <section role="alert" className="space-y-2 rounded-xl border border-destructive/40 p-4">
      <p>{error}</p>
      {phase === "error" && <button type="button" className={action} onClick={() => setReload(n => n + 1)}>Retry protected article listing</button>}
    </section>}
    {notice && <p role="status" className="rounded-xl border border-border p-4">{notice}</p>}
    {phase === "ready" && <div className="grid gap-5 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
      <nav aria-label="Help topics to edit" className="space-y-2">
        {helpArticles.map(item => {
          const saved = pages.find(candidate => candidate.slug === helpStudioSlug(item.slug));
          return <button key={item.slug} type="button" aria-current={selected === item.slug ? "true" : undefined}
            onClick={() => { setSelected(item.slug); setError(""); setNotice(""); }}
            className={"w-full rounded-xl border p-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 " +
              (selected === item.slug ? "border-cyan-500 bg-cyan-500/10" : "border-border")}>
            <span className="block font-semibold">{item.question}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{saved?.status === "published" ? "Published Studio answer" : saved?.status === "draft" ? "Private draft" : "Bundled answer"}</span>
          </button>;
        })}
      </nav>
      {article && <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase text-cyan-600">{article.category}</p>
          <h2 className="text-xl font-semibold">{article.question}</h2>
          <p className="text-sm text-muted-foreground">{article.description}</p>
        </header>
        <label className="block text-sm font-medium" htmlFor="help-editor-answer">Public answer
          <textarea id="help-editor-answer" className="mt-2 min-h-64 w-full rounded-xl border border-input bg-background p-3 leading-7"
            rows={12} maxLength={4000} value={answer}
            disabled={busy} onChange={e => setDrafts(current => ({ ...current, [selected]: e.target.value }))} />
        </label>
        <p className="text-xs text-muted-foreground">20–4,000 characters. The public article changes only after Website Studio confirms publication. If no Studio answer is published, the bundled answer remains visible.</p>
        <div className="flex flex-wrap gap-3">
          {page?.status !== "published" && <button type="button" className={action} disabled={busy || (!changed && page?.status === "draft")}
            onClick={() => save("draft")}>{busy ? "Saving…" : "Save private draft"}</button>}
          <button type="button" className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
            disabled={busy || (!changed && page?.status === "published")}
            onClick={() => save("published")}>{busy ? "Saving…" : "Publish answer"}</button>
          <Link className={action} to={"/help/" + article.slug} target="_blank" rel="noopener noreferrer">View public answer</Link>
        </div>
      </section>}
    </div>}
  </main>;
}
