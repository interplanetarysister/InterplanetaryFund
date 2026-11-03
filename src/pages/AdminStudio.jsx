import { useCallback, useEffect, useMemo, useState } from "react";\nimport { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Message, Loading } from "../components/UI";

const TYPES = [
  { type: "hero", label: "Hero section" },
  { type: "text", label: "Text section" },
  { type: "card", label: "Feature card" },
  { type: "button", label: "Call to action" },
  { type: "image", label: "Image section" },
];

const starter = () => ({
  slug: "new-page-" + Math.random().toString(36).slice(2, 7),
  title: "New page",
  status: "draft",
  content: {
    blocks: [
      {
        id: crypto.randomUUID(),
        type: "hero",
        heading: "Your headline",
        body: "Introduce this page and what visitors can do here.",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        heading: "A new section",
        body: "Add your content here.",
      },
    ],
  },
});

function blockDefaults(type) {
  const base = { id: crypto.randomUUID(), type, heading: "", body: "" };
  if (type === "button") return { ...base, label: "Learn more", url: "/" };
  if (type === "image")
    return { ...base, imageUrl: "", body: "Add an image URL." };
  return base;
}

export default function AdminStudio() {
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState("desktop");
  const [dragged, setDragged] = useState(null);
  const [dirty, setDirty] = useState(false);
  const blocks = page?.content?.blocks || [];

  const api = useCallback(async (path, method = "GET", body) => {
    if (!db) throw new Error("Supabase is not configured.");
    const { data, error: sessionError } = await db.auth.getSession();
    const token = data?.session?.access_token;
    if (sessionError || !token) {
      throw new Error("Your administrator session has expired. Sign in again.");
    }
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || "Studio request failed.");
    }
    return result;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await api("/api/studio/pages");
      setPages(rows);
      if (page?.id) {
        const fresh = rows.find((row) => row.id === page.id);
        if (fresh) setPage(fresh);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, page?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePage = (patch) => {
    setPage((current) => ({ ...current, ...patch }));
    setDirty(true);
    setNotice("");
  };

  const updateBlock = (id, patch) => {
    updatePage({
      content: {
        blocks: blocks.map((block) =>
          block.id === id ? { ...block, ...patch } : block,
        ),
      },
    });
  };

  const moveBlock = (from, to) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updatePage({ content: { blocks: next } });
  };

  const addBlock = (type) => {
    updatePage({ content: { blocks: [...blocks, blockDefaults(type)] } });
  };

  const removeBlock = (id) => {
    updatePage({
      content: { blocks: blocks.filter((block) => block.id !== id) },
    });
  };

  const save = async (status = "draft") => {
    if (!page || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        slug: page.slug,
        title: page.title,
        content: page.content,
        status,
      };
      const saved = page.id
        ? await api(
            "/api/studio/pages/" + encodeURIComponent(page.id),
            "PATCH",
            payload,
          )
        : await api("/api/studio/pages", "POST", payload);
      setPage(saved);
      setPages((current) => [
        saved,
        ...current.filter((entry) => entry.id !== saved.id),
      ]);
      setDirty(false);
      setNotice(
        status === "published"
          ? "Page saved and marked published in Studio."
          : "Draft saved to Supabase.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setPage(starter());
    setDirty(true);
    setError("");
    setNotice("");
  };

  const selectPage = (entry) => {
    setPage(entry);
    setDirty(false);
    setError("");
    setNotice("");
  };

  const previewClass = useMemo(() => "studio-preview " + preview, [preview]);

  if (loading && !page) {
    return (
      <main className="studio-shell">
        <Loading />
      </main>
    );
  }

  return (
    <main className="studio-shell">
      <div className="studio-heading">
        <div>
          <p className="eyebrow">INTERPLANETARY FUND / ADMIN</p>
          <h1>IFund Studio</h1>
          <p>
            Build structured page layouts with reusable sections, then preview
            and save them.
          </p>
        </div>
        <div className="studio-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setPreview("desktop")}
            aria-pressed={preview === "desktop"}
          >
            Desktop
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setPreview("mobile")}
            aria-pressed={preview === "mobile"}
          >
            Mobile
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => save("draft")}
            disabled={!page || busy || !dirty}
          >
            {busy ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => save("published")}
            disabled={!page || busy || !dirty}
          >
            Mark published
          </button>
        </div>
      </div>

      <Message error={Boolean(error)}>{error}</Message>
      <Message>{notice}</Message>

      <div className="studio-layout">
        <aside className="studio-sidebar">
          <div className="studio-sidebar-head">
            <strong>Pages</strong>
            <button type="button" onClick={startNew}>
              ＋ New
            </button>
          </div>
          {pages.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={
                "studio-page-link " + (page?.id === entry.id ? "selected" : "")
              }
              onClick={() => selectPage(entry)}
            >
              <span>{entry.title}</span>
              <small>{entry.status}</small>
            </button>
          ))}
          {!pages.length && <p className="studio-muted">No saved pages yet.</p>}
          <button
            type="button"
            className="secondary studio-refresh"
            onClick={load}
            disabled={loading}
          >
            Refresh pages
          </button>
        </aside>

        <section className="studio-editor">
          {!page ? (
            <div className="studio-empty">
              <h2>Start building</h2>
              <p>Create a page to add sections and preview the result.</p>
              <button type="button" className="primary" onClick={startNew}>
                Create a page
              </button>
            </div>
          ) : (
            <>
              <div className="studio-fields">
                <label>
                  Page title
                  <input
                    value={page.title}
                    maxLength={120}
                    onChange={(event) =>
                      updatePage({ title: event.target.value })
                    }
                  />
                </label>
                <label>
                  URL slug
                  <input
                    value={page.slug}
                    maxLength={60}
                    onChange={(event) =>
                      updatePage({
                        slug: event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                  />
                </label>
                <span className="studio-status">
                  {page.status || "draft"}{" "}
                  {dirty ? "· unsaved changes" : "· saved"}
                </span>
              </div>

              <div className="studio-builder">
                <div className="studio-blocks">
                  <div className="studio-section-title">
                    <h2>Page sections</h2>
                    <span>{blocks.length}/40</span>
                  </div>

                  {blocks.map((block, index) => (
                    <article
                      key={block.id}
                      className="studio-block"
                      draggable
                      onDragStart={() => setDragged(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragged !== null) moveBlock(dragged, index);
                        setDragged(null);
                      }}
                      onDragEnd={() => setDragged(null)}
                    >
                      <div className="studio-block-head">
                        <strong>
                          {TYPES.find((item) => item.type === block.type)
                            ?.label || block.type}
                        </strong>
                        <div>
                          <button
                            type="button"
                            aria-label="Move section up"
                            onClick={() => moveBlock(index, index - 1)}
                            disabled={index === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label="Move section down"
                            onClick={() => moveBlock(index, index + 1)}
                            disabled={index === blocks.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => removeBlock(block.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <label>
                        Heading
                        <input
                          value={block.heading || ""}
                          maxLength={180}
                          onChange={(event) =>
                            updateBlock(block.id, {
                              heading: event.target.value,
                            })
                          }
                        />
                      </label>

                      {block.type === "image" && (
                        <label>
                          Image URL
                          <input
                            type="url"
                            value={block.imageUrl || ""}
                            onChange={(event) =>
                              updateBlock(block.id, {
                                imageUrl: event.target.value,
                              })
                            }
                            placeholder="https://…"
                          />
                        </label>
                      )}

                      {block.type === "button" && (
                        <>
                          <label>
                            Button label
                            <input
                              value={block.label || ""}
                              onChange={(event) =>
                                updateBlock(block.id, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Destination URL
                            <input
                              type="url"
                              value={block.url || ""}
                              onChange={(event) =>
                                updateBlock(block.id, {
                                  url: event.target.value,
                                })
                              }
                              placeholder="https://… or /path"
                            />
                          </label>
                        </>
                      )}

                      <label>
                        Body
                        <textarea
                          rows={3}
                          maxLength={4000}
                          value={block.body || ""}
                          onChange={(event) =>
                            updateBlock(block.id, { body: event.target.value })
                          }
                        />
                      </label>
                    </article>
                  ))}

                  <div className="studio-add-block">
                    <strong>Add a section</strong>
                    <div>
                      {TYPES.map((item) => (
                        <button
                          type="button"
                          key={item.type}
                          className="secondary"
                          onClick={() => addBlock(item.type)}
                          disabled={blocks.length >= 40}
                        >
                          ＋ {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={previewClass}>
                  <div className="studio-preview-top">
                    <span>Live preview</span>
                    <span>{preview === "mobile" ? "390px" : "Responsive"}</span>
                  </div>
                  <div className="studio-preview-canvas">
                    {blocks.map((block) => (
                      <section
                        key={block.id}
                        className={"studio-render studio-render-" + block.type}
                      >
                        {block.type === "image" && block.imageUrl && (
                          <img src={block.imageUrl} alt={block.heading || ""} />
                        )}
                        {block.heading && <h2>{block.heading}</h2>}
                        {block.body && <p>{block.body}</p>}
                        {block.type === "button" && (
                          <a
                            className="primary"
                            href={block.url || "#"}
                            onClick={(event) => {
                              if (!block.url || block.url.startsWith("/")) {
                                event.preventDefault();
                              }
                            }}
                          >
                            {block.label || "Learn more"}
                          </a>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <p className="studio-footnote">
        Studio saves structured page drafts to Supabase. Marking a page
        published records its Studio status; it does not deploy code or create a
        live site route. AI code generation and GitHub publishing are separate
        capabilities and are not enabled in this first package.
      </p>
    </main>
  );
}
