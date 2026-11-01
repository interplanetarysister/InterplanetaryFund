import { Link, useParams } from "react-router-dom";
import { displayHelpCategory } from "../lib/helpCenter";
import { publicHelpArticle } from "../lib/publicHelp";

export default function HelpArticle() {
  const { slug } = useParams();
  const article = publicHelpArticle(slug);
  return <main className="public-page">
    <Link className="help-back" to="/help">Back to Help Center</Link>
    {article ? <article className="card public-article">
      <small>{displayHelpCategory(article.category)}</small>
      <h1>{article.question}</h1>
      <p className="lede">{article.description}</p>
      <div className="help-answer">{article.answer}</div>
      <p><Link to="/contact">Still need help? Contact support</Link></p>
    </article> : <section className="card" role="status">
      <h1>Article unavailable</h1>
      <p>This article has not yet been verified or published on the independent platform. No unpublished or private article content is exposed.</p>
      <Link className="primary" to="/help">Browse available guides</Link>
    </section>}
  </main>;
}
