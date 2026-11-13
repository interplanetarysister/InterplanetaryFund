import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { helpArticleBySlug } from "@/lib/helpArticles";
import { helpStudioAnswer, helpStudioSlug } from "@/lib/studioHelpContent.mjs";

export default function HelpArticle() {
  const { slug } = useParams();
  const article = helpArticleBySlug(slug);
  const [state, setState] = useState({ phase: "loading", answer: null });

  useEffect(() => {
    let active = true;
    setState({ phase: "loading", answer: null });
    if (!article) {
      setState({ phase: "missing", answer: null });
      return () => { active = false; };
    }
    fetch("/api/public/studio/pages/" + encodeURIComponent(helpStudioSlug(article.slug)), {
      method: "GET", cache: "no-store",
    }).then(async response => {
      if (response.status === 404) return { phase: "bundled", answer: null };
      if (!response.ok) throw new Error("Published Help Center updates are unavailable.");
      const result = await response.json();
      const answer = helpStudioAnswer(result, article.slug);
      if (!answer) throw new Error("The published Help Center response could not be verified.");
      return { phase: "published", answer };
    }).then(result => {
      if (active) setState(result);
    }).catch(() => {
      if (active) setState({ phase: "unavailable", answer: null });
    });
    return () => { active = false; };
  }, [article?.slug]);

  return <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10 min-w-0 text-foreground">
    <Link to="/help" className="font-semibold text-cyan-700 underline">Back to Help Center</Link>
    {article ? <article className="mt-8">
      <p className="text-sm font-semibold text-cyan-700">{article.category}</p>
      <h1 className="font-display text-3xl sm:text-4xl mt-2 break-words">{article.question}</h1>
      <p className="text-muted-foreground mt-3">{article.description}</p>
      <div className="border-t border-border my-7" />
      {state.phase === "loading" && <p role="status" className="text-sm text-muted-foreground">Checking the latest published answer…</p>}
      {state.phase === "unavailable" && <p role="status" className="mb-4 rounded-lg border border-amber-500/30 p-3 text-sm">The current online Help Center revision could not be checked. Showing the bundled guidance.</p>}
      <div className="whitespace-pre-wrap leading-8 break-words">{state.answer || article.answer}</div>
      <div className="mt-8 rounded-xl border border-border p-5">
        <h2 className="font-semibold">Still need help?</h2>
        <Link to="/support" className="inline-block mt-3 font-semibold text-cyan-700 underline">
          Open a support request
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">Support requests require you to sign in. Never include passwords, payment cards, or verification codes.</p>
      </div>
    </article> : <section className="mt-8" role="status">
      <h1 className="font-display text-3xl">Help article unavailable</h1>
      <p className="mt-4">This article is not in the current Help Center.</p>
      <Link to="/help" className="inline-block mt-4 text-cyan-700 underline">Browse current help topics</Link>
    </section>}
  </main>;
}
