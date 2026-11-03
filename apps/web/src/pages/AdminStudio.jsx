import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

const TYPES = [
  { type: "hero", label: "Hero" },
  { type: "text", label: "Text" },
  { type: "card", label: "Feature card" },
  { type: "button", label: "Call to action" },
  { type: "image", label: "Image" },
];
const starter = () => ({
  slug: "new-page-" + Math.random().toString(36).slice(2, 7),
  title: "New page",
  status: "draft",
  content: { blocks: [
    { id: crypto.randomUUID(), type: "hero", heading: "Your headline", body: "Introduce this page and what visitors can do here." },
    { id: crypto.randomUUID(), type: "text", heading: "A new section", body: "Add your content here." },
  ] },
});
const defaults = (type) => {
  const base = { id: crypto.randomUUID(), type, heading: "", body: "" };
  if (type === "button") return { ...base, label: "Learn more", url: "/" };
  if (type === "image") return { ...base, imageUrl: "", body: "Add an image URL." };
  return base;
};
function Notice({ error = false, children }) {
  if (!children) return null;
  return <p role={error ? "alert" : "status"} className={"studio-notice " + (error ? "is-error" : "")}>{children}</p>;
}
export default function AdminStudio() {
  const db = useMemo(() => authClient(), []);
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState("desktop");
  const [dirty, setDirty] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [versions, setVersions] = useState([]);
  const [dragged, setDragged] = useState(null);
  const dirtyRef = useRef(false);
  const selectedPageId = useRef(null);
  const blocks = page?.content?.blocks || [];

  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { selectedPageId.current = page?.id || null; }, [page?.id]);

  const api = useCallback(async (path, method = "GET", body, extraHeaders = {}) => {
    const { data, error: sessionError } = await db.auth.getSession();
    const token = data?.session?.access_token;
    if (sessionError || !token) throw new Error("Your administrator session has expired. Sign in again.");
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "Studio request failed (" + response.status + ").");
    return result;
  }, [db]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await api("/api/studio/pages?limit=100&offset=0");
      setPages(rows);
      setHasMore(rows.length === 100);
      const selectedId = selectedPageId.current;
      const fresh = selectedId ? rows.find((row) => row.id === selectedId) : null;
      if (fresh && !dirtyRef.current) setPage(fresh);
      const status = await api("/api/studio/status").catch(() => null);
      setAiEnabled(status?.aiEnabled === true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!page?.id) { setVersions([]); return undefined; }
    let active = true;
    api("/api/studio/pages/" + encodeURIComponent(page.id) + "/versions")
      .then((rows) => { if (active) setVersions(rows); })
      .catch(() => { if (active) setVersions([]); });
    return () => { active = false; };
  }, [api, page?.id, page?.updated_at]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async (status = "draft") => {
    if (!page || busy) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = { slug: page.slug, title: page.title, content: page.content, status };
      const headers = page.id && page.updated_at ? { "If-Match": page.updated_at } : {};
      const saved = page.id
        ? await api("/api/studio/pages/" + encodeURIComponent(page.id), "PATCH", payload, headers)
        : await api("/api/studio/pages", "POST", payload);
      setPage(saved);
      setPages((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      setDirty(false);
      setNotice(status === "published" ? "Page saved and published." : "Draft saved.");
      return saved;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const selectPage = async (entry) => {
    if (busy) return;
    if (dirty) {
      const saved = await save("draft");
      if (!saved) return;
    }
    setPage(entry); setDirty(false); setError(""); setNotice("");
  };

  const startNew = async () => {
    if (busy) return;
    if (dirty) {
      const saved = await save("draft");
      if (!saved) return;
    }
    setPage(starter()); setDirty(true); setError(""); setNotice("");
  };

  const updatePage = (patch) => {
    setPage((current) => ({ ...current, ...patch }));
    setDirty(true); setNotice("");
  };
  const updateBlock = (id, patch) => updatePage({
    content: { blocks: blocks.map((block) => block.id === id ? { ...block, ...patch } : block) },
  });
  const moveBlock = (from, to) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    updatePage({ content: { blocks: next } });
  };
  const addBlock = (type) => {
    if (blocks.length >= 40) return;
    updatePage({ content: { blocks: [...blocks, defaults(type)] } });
  };
  const removeBlock = (id) => updatePage({ content: { blocks: blocks.filter((block) => block.id !== id) } });

  const generateLayout = async () => {
    if (!page || busy || !aiEnabled || !aiPrompt.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const generated = await api("/api/studio/generate", "POST", { prompt: aiPrompt.trim() });
      setPage((current) => ({ ...current, content: generated.content }));
      setDirty(true);
      setNotice("AI layout is ready. Review it and save when ready.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const restoreVersion = async (version) => {
    if (!page?.id || busy) return;
    let target = page;
    if (dirty) {
      const saved = await save("draft");
      if (!saved) return;
      target = saved;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const restored = await api(
        "/api/studio/pages/" + encodeURIComponent(target.id) + "/versions/" + version + "/restore",
        "POST", undefined, target.updated_at ? { "If-Match": target.updated_at } : {},
      );
      setPage(restored);
      setPages((current) => current.map((entry) => entry.id === restored.id ? restored : entry));
      setDirty(false);
      setNotice("Version " + version + " restored as a new draft revision.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const loadMore = async () => {
    if (loadingMore || busy || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await api("/api/studio/pages?limit=100&offset=" + pages.length);
      setPages((current) => [...current, ...rows.filter((row) => !current.some((old) => old.id === row.id))]);
      setHasMore(rows.length === 100);
    } catch (err) { setError(err.message); }
    finally { setLoadingMore(false); }
  };

  const pageBusy = busy || loading || loadingMore;
  const previewClass = "studio-preview studio-preview-" + preview;

  return (
    <main className="studio-shell">
      <div className="studio-heading">
        <div>
          <p className="studio-eyebrow">INTERPLANETARY FUND / SUPER ADMIN</p>
          <h1>Website Studio</h1>
          <p>Build, preview, version, and publish pages for Interplanetary Fund.</p>
        </div>
        <div className="studio-actions">
          <button type="button" className={preview === "desktop" ? "is-selected" : ""} onClick={() => setPreview("desktop")} aria-pressed={preview === "desktop"}>Desktop</button>
          <button type="button" className={preview === "mobile" ? "is-selected" : ""} onClick={() => setPreview("mobile")} aria-pressed={preview === "mobile"}>Mobile</button>
          <button type="button" className="studio-primary" onClick={() => save("draft")} disabled={!page || busy || !dirty}>{busy ? "Saving…" : "Save draft"}</button>
          <button type="button" className="studio-publish" onClick={() => save("published")} disabled={!page || busy || (page.status === "published" && !dirty)}>Publish page</button>
        </div>
      </div>

      <Notice error={Boolean(error)}>{error}</Notice>
      <Notice>{notice}</Notice>

      <div className="studio-layout">
        <aside className="studio-sidebar">
          <div className="studio-sidebar-head">
            <strong>Pages</strong>
            <button type="button" onClick={startNew} disabled={pageBusy}>＋ New</button>
          </div>
          {pages.map((entry) => (
            <button type="button" key={entry.id} className={"studio-page-link " + (page?.id === entry.id ? "selected" : "")} onClick={() => selectPage(entry)} disabled={pageBusy}>
              <span>{entry.title}</span><small>{entry.status}</small>
            </button>
          ))}
          {loading && !pages.length && <p className="studio-muted">Loading pages…</p>}
          {!loading && !pages.length && <p className="studio-muted">No saved pages yet.</p>}
          {hasMore && <button type="button" className="studio-secondary studio-load-more" onClick={loadMore} disabled={pageBusy}>{loadingMore ? "Loading…" : "Load more pages"}</button>}
          <button type="button" className="studio-secondary studio-refresh" onClick={load} disabled={pageBusy}>Refresh pages</button>
        </aside>

        <section className="studio-editor">
          {!page ? (
            <div className="studio-empty">
              <h2>Start building</h2>
              <p>Create a page, add sections, and preview the result before publishing.</p>
              <button type="button" className="studio-primary" onClick={startNew} disabled={pageBusy}>Create a page</button>
            </div>
          ) : (
            <fieldset className="studio-editor-controls" disabled={busy}>
              <div className="studio-fields">
                <label>Page title
                  <input value={page.title} maxLength={120} onChange={(event) => updatePage({ title: event.target.value })} />
                </label>
                <label>URL slug
                  <input value={page.slug} maxLength={60} onChange={(event) => updatePage({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
                </label>
                <span className="studio-status">{page.status || "draft"} · {dirty ? "unsaved changes" : "saved"}</span>
                {page.status === "published" && page.id && <Link to={"/p/" + page.slug} target="_blank" rel="noreferrer">Open published page</Link>}
              </div>

              <div className="studio-ai-panel">
                <label>Describe the page you want
                  <textarea rows={3} maxLength={1200} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Create a welcoming landing page with a clear headline, helpful sections, and a strong call to action…" />
                </label>
                <div>
                  <button type="button" className="studio-secondary" onClick={generateLayout} disabled={!aiEnabled || !aiPrompt.trim() || busy}>Generate with AI</button>
                  <span>{aiEnabled ? "Free-tier AI assistance · daily quota protected" : "AI assistance will appear when the free Cloudflare AI binding is enabled."}</span>
                </div>
              </div>

              <div className="studio-history-panel">
                <div><h3>Version history</h3><span>{versions.length} recent revisions</span></div>
                {versions.length ? <ul>{versions.map((entry) => (
                  <li key={entry.id}>
                    <span><strong>Version {entry.version}</strong><small>{new Date(entry.created_at).toLocaleString()}</small></span>
                    <button type="button" onClick={() => restoreVersion(entry.version)} disabled={busy || entry.version === versions[0]?.version}>Restore as draft</button>
                  </li>
                ))}</ul> : <p>Save this page to start its version history.</p>}
              </div>

              <div className="studio-builder">
                <div className="studio-blocks">
                  <div className="studio-section-title"><h2>Page sections</h2><span>{blocks.length}/40</span></div>
                  {blocks.map((block, index) => (
                    <article key={block.id} className="studio-block" draggable onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged !== null) moveBlock(dragged, index); setDragged(null); }} onDragEnd={() => setDragged(null)}>
                      <div className="studio-block-head">
                        <strong>{TYPES.find((item) => item.type === block.type)?.label || block.type}</strong>
                        <div>
                          <button type="button" onClick={() => moveBlock(index, index - 1)} disabled={index === 0}>↑</button>
                          <button type="button" onClick={() => moveBlock(index, index + 1)} disabled={index === blocks.length - 1}>↓</button>
                          <button type="button" className="studio-text-button" onClick={() => removeBlock(block.id)}>Remove</button>
                        </div>
                      </div>
                      <label>Heading<input value={block.heading || ""} maxLength={180} onChange={(event) => updateBlock(block.id, { heading: event.target.value })} /></label>
                      {block.type === "image" && <label>Image URL<input type="url" value={block.imageUrl || ""} onChange={(event) => updateBlock(block.id, { imageUrl: event.target.value })} placeholder="https://…" /></label>}
                      {block.type === "button" && <><label>Button label<input value={block.label || ""} onChange={(event) => updateBlock(block.id, { label: event.target.value })} /></label><label>Destination URL<input type="url" value={block.url || ""} onChange={(event) => updateBlock(block.id, { url: event.target.value })} placeholder="https://… or /path" /></label></>}
                      <label>Body<textarea rows={3} maxLength={4000} value={block.body || ""} onChange={(event) => updateBlock(block.id, { body: event.target.value })} /></label>
                    </article>
                  ))}
                  <div className="studio-add-block"><strong>Add a section</strong><div>{TYPES.map((item) => <button type="button" key={item.type} className="studio-secondary" onClick={() => addBlock(item.type)} disabled={blocks.length >= 40}>＋ {item.label}</button>)}</div></div>
                </div>
                <div className={previewClass}>
                  <div className="studio-preview-top"><span>Live preview</span><span>{preview === "mobile" ? "390px" : "Responsive"}</span></div>
                  <div className="studio-preview-canvas">
                    {blocks.map((block) => (
                      <section key={block.id} className={"studio-render studio-render-" + block.type}>
                        {block.type === "image" && block.imageUrl && <img src={block.imageUrl} alt={block.heading || ""} />}
                        {block.heading && <h2>{block.heading}</h2>}
                        {block.body && <p>{block.body}</p>}
                        {block.type === "button" && <a className="studio-preview-button" href={block.url || "#"} onClick={(event) => { if (!block.url) event.preventDefault(); }}>{block.label || "Learn more"}</a>}
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </fieldset>
          )}
        </section>
      </div>
      <p className="studio-footnote">Studio creates and publishes structured pages stored in the IFund production database. It does not deploy application source code; code changes use the protected GitHub build pipeline.</p>
    </main>
  );
}
