import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loading, Message } from "../components/UI";

export default function StudioPublishedPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch("/api/public/studio/pages/" + encodeURIComponent(slug))
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || "This page is not available.");
        }
        return result;
      })
      .then((result) => {
        if (active) setPage(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="studio-public-page">
        <Loading />
      </main>
    );
  }
  if (error || !page) {
    return (
      <main className="studio-public-page">
        <Message error>{error || "This page is not available."}</Message>
        <Link to="/">Return to Interplanetary Fund</Link>
      </main>
    );
  }

  return (
    <main className="studio-public-page">
      <p className="eyebrow">INTERPLANETARY FUND</p>
      <h1>{page.title}</h1>
      {(page.content?.blocks || []).map((block) => (
        <section
          key={block.id}
          className={"studio-render studio-render-" + block.type}
        >
          {block.type === "image" && block.imageUrl && (
            <img src={block.imageUrl} alt={block.heading || ""} />
          )}
          {block.heading && <h2>{block.heading}</h2>}
          {block.body && <p>{block.body}</p>}
          {block.type === "button" && block.label && block.url && (
            <a
              className="primary"
              href={block.url}
              rel="noreferrer"
              target={block.url.startsWith("http") ? "_blank" : undefined}
            >
              {block.label}
            </a>
          )}
        </section>
      ))}
      <Link to="/">Back to Interplanetary Fund</Link>
    </main>
  );
}
