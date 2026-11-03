import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function StudioPublishedPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setPage(null);
    fetch("/api/public/studio/pages/" + encodeURIComponent(slug))
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || "This page is not available.");
        return result;
      })
      .then((result) => { if (active) setPage(result); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  if (loading) return <main className="studio-public-shell" role="status">Loading page…</main>;
  if (error || !page) return <main className="studio-public-shell"><h1>Page unavailable</h1><p>{error || "This page could not be found."}</p><Link to="/">Return to Interplanetary Fund</Link></main>;
  return (
    <main className="studio-public-shell">
      <header className="studio-public-header"><Link to="/">Interplanetary Fund</Link><span>What if?</span></header>
      <article className="studio-public-page">
        <p className="studio-eyebrow">INTERPLANETARY FUND</p>
        <h1>{page.title}</h1>
        {(page.content?.blocks || []).map((block) => (
          <section key={block.id} className={"studio-render studio-render-" + block.type}>
            {block.type === "image" && block.imageUrl && <img src={block.imageUrl} alt={block.heading || ""} loading="lazy" />}
            {block.heading && <h2>{block.heading}</h2>}
            {block.body && <p>{block.body}</p>}
            {block.type === "button" && block.url && <a className="studio-preview-button" href={block.url} target={/^https?:/i.test(block.url) ? "_blank" : undefined} rel="noopener noreferrer">{block.label || "Learn more"}</a>}
          </section>
        ))}
      </article>
      <footer className="studio-public-footer"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/">Interplanetary Fund</Link></footer>
    </main>
  );
}
