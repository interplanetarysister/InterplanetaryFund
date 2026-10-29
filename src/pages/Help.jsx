import { Link, useSearchParams } from "react-router-dom";
import { HELP_CATEGORIES, HELP_ARTICLES } from "../lib/helpArticles";

export default function Help() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const category = params.get("category") || "";
  const update = (field, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(field, value); else next.delete(field);
    setParams(next, { replace: true });
  };
  const q = query.trim().toLocaleLowerCase();
  const results = HELP_ARTICLES.filter((article) =>
    (!category || category === article.category) &&
    (!q || [article.question, article.answer].join(" ").toLocaleLowerCase().includes(q)));
  return <main className="help-center">
    <section className="help-hero">
      <h1>How can we help?</h1>
      <p>The Interplanetary Fund Help Center</p>
      <label htmlFor="help-search">Search help topics
        <input type="search" id="help-search" value={query}
          onChange={(e) => update("q", e.target.value)} placeholder="Search for answers…" /></label>
    </section>
    <section>
      <h2>Browse by topic</h2>
      <div className="help-topics" role="group" aria-label="Filter help articles">
        <button type="button" className={!category ? "primary" : "secondary"}
          aria-pressed={!category} onClick={() => update("category", "")}>All topics</button>
        {HELP_CATEGORIES.map((topic) =>
          <button key={topic.id} type="button"
            className={category === topic.id ? "primary" : "secondary"}
            aria-pressed={category === topic.id}
            onClick={() => update("category", category === topic.id ? "" : topic.id)}>
            {topic.title}</button>)}
      </div>
    </section>
    <section>
      <h2>{query || category ? "Matching articles" : "Help articles"}</h2>
      {results.length ? <div className="help-results">{results.map((article) =>
        <Link to={"/help/" + article.slug} key={article.slug} className="card">
          <small>{HELP_CATEGORIES.find((c) => c.id === article.category)?.title}</small>
          <h3>{article.question}</h3>
          <p>{article.answer.slice(0, 140)}{article.answer.length > 140 ? "…" : ""}</p>
        </Link>)}</div> : <p>No articles match your search. Try another term or topic.</p>}
    </section>
    <section className="card">
      <h2>Documents & rights</h2>
      <p>Read the current public privacy policy and terms.</p>
      <div className="actions">
        <Link className="secondary" to="/terms">Terms of Service</Link>
        <Link className="secondary" to="/privacy">Privacy Policy</Link>
      </div>
    </section>
  </main>;
}
