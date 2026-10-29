import { Link, useParams } from "react-router-dom";
import { HELP_CATEGORIES, helpArticle } from "../lib/helpArticles";

export default function HelpArticle() {
  const { slug } = useParams();
  const article = helpArticle(slug);
  if (!article) return <main className="help-center"><h1>Article not found</h1>
    <Link className="secondary" to="/help">Back to Help Center</Link></main>;
  return <main className="help-article">
    <Link to="/help">← Help Center</Link>
    <p className="eyebrow">{HELP_CATEGORIES.find((c) => c.id === article.category)?.title}</p>
    <h1>{article.question}</h1>
    <section className="card"><p>{article.answer}</p></section>
    {article.link && <Link className="primary" to={article.link}>{article.label}</Link>}
    <div className="card"><h2>More questions?</h2>
      <p>Search the Help Center for additional instructions and current feature availability.</p>
      <Link to="/help">Browse help articles</Link>
    </div>
  </main>;
}
