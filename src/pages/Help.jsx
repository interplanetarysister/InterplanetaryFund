import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HELP_CATEGORIES, displayHelpCategory, helpArticlePath } from "../lib/helpCenter";
import { PUBLIC_HELP_ARTICLES } from "../lib/publicHelp";

export default function Help() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const category = params.get("category") || "";
  const filtered = useMemo(() => PUBLIC_HELP_ARTICLES.filter((article) => {
    if (category && displayHelpCategory(article.category) !== category) return false;
    const text = [article.question, article.description, article.category, article.answer].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [query, category]);
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  return (
    <main className="public-page" aria-labelledby="help-title">
      <section className="public-hero">
        <p className="eyebrow">SUPPORT AND GUIDANCE</p>
        <h1 id="help-title">How can we help?</h1>
        <p>Find answers about campaigns, connections, security and the ongoing platform migration.</p>
        <label htmlFor="help-search">Search help articles</label>
        <input id="help-search" value={query} onChange={(event) => update("q", event.target.value)} placeholder="Search for answers" type="search" />
      </section>
      <section aria-labelledby="help-topics-title">
        <h2 id="help-topics-title">Browse by topic</h2>
        <div className="help-topic-grid">
          {HELP_CATEGORIES.map((item) => <button type="button" key={item.name}
            aria-pressed={category === item.name} onClick={() => update("category", category === item.name ? "" : item.name)}>
            <strong>{item.name}</strong><small>{item.description}</small>
          </button>)}
        </div>
      </section>
      <section aria-labelledby="help-articles-title">
        <h2 id="help-articles-title">{query || category ? "Matching guides" : "Help guides"}</h2>
        {filtered.length ? <ul className="help-article-list">{filtered.map((article) => <li key={article.slug}>
          <Link className="card" to={helpArticlePath(article.slug)}>
            <small>{displayHelpCategory(article.category)}</small><h3>{article.question}</h3><p>{article.description}</p>
          </Link>
        </li>)}</ul> : <div className="card"><p>No guides match that search.</p>
          <button type="button" onClick={() => setParams({}, { replace: true })}>Clear search</button></div>}
      </section>
      <section className="card" aria-labelledby="help-legal-title">
        <h2 id="help-legal-title">Legal documents and rights</h2>
        <p>Read the source-aligned policies. No sign-in is required to view them.</p>
        <div className="actions"><Link className="secondary" to="/terms">Terms of Service</Link><Link className="secondary" to="/privacy">Privacy Policy</Link></div>
      </section>
      <section className="card" aria-labelledby="help-contact-title">
        <h2 id="help-contact-title">Still need assistance?</h2>
        <p>Private support tickets and the full published article library are still being migrated. No ticket is submitted from this page.</p>
        <Link className="primary" to="/contact">Contact IFund</Link>
      </section>
    </main>
  );
}
