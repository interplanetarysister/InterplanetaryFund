import { Link, useParams } from "react-router-dom";
import { helpArticleBySlug } from "@/lib/helpArticles";

export default function HelpArticle() {
  const { slug } = useParams();
  const article = helpArticleBySlug(slug);
  return <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10 min-w-0 text-foreground">
    <Link to="/help" className="font-semibold text-cyan-700 underline">Back to Help Center</Link>
    {article ? <article className="mt-8">
      <p className="text-sm font-semibold text-cyan-700">{article.category}</p>
      <h1 className="font-display text-3xl sm:text-4xl mt-2 break-words">{article.question}</h1>
      <p className="text-muted-foreground mt-3">{article.description}</p>
      <div className="border-t border-border my-7" />
      <div className="whitespace-pre-wrap leading-8 break-words">{article.answer}</div>
      <div className="mt-8 rounded-xl border border-border p-5">
        <h2 className="font-semibold">Still need help?</h2>
        <a href="mailto:support@interplanetaryfund.com" className="inline-block mt-3 font-semibold text-cyan-700 underline">
          Contact support
        </a>
      </div>
    </article> : <section className="mt-8" role="status">
      <h1 className="font-display text-3xl">Help article unavailable</h1>
      <p className="mt-4">This article has not yet been verified on the independent platform.</p>
      <Link to="/help" className="inline-block mt-4 text-cyan-700 underline">Browse current help topics</Link>
    </section>}
  </main>;
}
