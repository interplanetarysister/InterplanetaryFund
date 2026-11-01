import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search, LifeBuoy, Link2, ArrowRight, BookOpen, Rocket,
  Megaphone, HeartHandshake, Wallet, ShieldCheck, CreditCard, Bot, Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { HELP_CATEGORIES, helpArticlePath } from "@/lib/helpCenter";
import { helpArticles } from "@/lib/helpArticles";
import { authClient } from "@/api/auth";
import { listPublicHelpArticles } from "@/lib/helpPublic";

const CATEGORY_ICONS = { Rocket, Megaphone, HeartHandshake, Link2, Wallet, ShieldCheck, CreditCard, Bot, Users };

export default function Help() {
  const [articles,setArticles]=useState(helpArticles);
  useEffect(()=>{
    let mounted=true;
    try{
      listPublicHelpArticles(authClient())
        .then(result=>{if(mounted)setArticles(result.articles);})
        .catch(()=>{if(mounted)setArticles(helpArticles);});
    }catch{setArticles(helpArticles);}
    return()=>{mounted=false;};
  },[]);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const category = params.get("category") || "";
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return articles.filter((article) => {
      if (category && article.category !== category) return false;
      return !q || [article.question, article.description, article.answer, article.category]
        .join(" ").toLocaleLowerCase().includes(q);
    });
  }, [query, category, articles]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return <div className="w-full min-w-0">
    <header className="bg-slate-950 text-white border-b border-cyan-500/20 px-4 sm:px-8 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-center mb-4">
          <LifeBuoy className="w-9 h-9 text-cyan-300" aria-hidden="true" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-center text-white">How can we help?</h1>
        <p className="text-slate-300 mt-2 text-center">The Interplanetary Fund Help Center</p>
        <label htmlFor="help-search" className="sr-only">Search IFund help articles</label>
        <div className="relative mt-7 max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" aria-hidden="true" />
          <Input id="help-search" type="search" value={query}
            onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="Search for answers…"
            className="min-h-12 pl-12 bg-white text-slate-950 placeholder:text-slate-500 border-slate-300" />
        </div>
      </div>
    </header>

    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
      <section aria-labelledby="help-topics-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="help-topics-heading" className="font-display text-xl sm:text-2xl text-foreground">Browse by topic</h2>
          {category && <button type="button" className="text-sm font-semibold text-cyan-700 underline underline-offset-4"
            onClick={() => updateFilter("category", "")}>Show all topics</button>}
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3">
          {HELP_CATEGORIES.map((item) => {
            const Icon = CATEGORY_ICONS[item.icon] || BookOpen;
            const selected = category === item.name;
            return <button type="button" key={item.name} aria-pressed={selected}
              onClick={() => updateFilter("category", selected ? "" : item.name)}
              className={"min-w-0 min-h-[100px] text-left rounded-2xl border p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 " +
                (selected ? "bg-cyan-50 border-cyan-500 text-slate-950" : "bg-card border-border text-foreground hover:border-cyan-400")}>
              <Icon className="w-6 h-6 text-cyan-600 mb-2" aria-hidden="true" />
              <span className="block font-semibold leading-snug">{item.name}</span>
              <span className="block text-sm mt-1 text-muted-foreground">{item.description}</span>
            </button>;
          })}
        </div>
      </section>

      <section aria-labelledby="help-legal-heading" className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 id="help-legal-heading" className="text-xl font-semibold text-foreground">Legal documents &amp; rights</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Public IFund agreements and privacy information. No sign-in required.
        </p>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[["/terms", "Terms of Service"], ["/privacy", "Privacy Policy"]].map(([path, label]) =>
            <li key={path}><Link to={path}
              className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 font-medium text-foreground hover:border-cyan-500">
              {label}<ArrowRight className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" />
            </Link></li>)}
        </ul>
      </section>

      <section aria-labelledby="help-connections-heading" className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 id="help-connections-heading" className="font-semibold text-xl">Using connections and AI</h2>
        <p className="text-sm text-muted-foreground">Find the original connection and AI-permissions guidance, with current migration availability clearly identified.</p>
        <div className="space-y-2">
          {articles.filter(a => ["Connections & Publishing", "AI Assistance"].includes(a.category)).map((article) =>
            <Link key={article.slug} to={helpArticlePath(article.slug)}
              className="block rounded-xl border border-border px-4 py-3 font-semibold hover:border-cyan-400">
              {article.question} <ArrowRight className="inline w-4 h-4 text-cyan-600 ml-1" aria-hidden="true" />
            </Link>)}
        </div>
      </section>

      <section aria-labelledby="help-articles-heading">
        <h2 id="help-articles-heading" className="font-display text-xl sm:text-2xl text-foreground mb-4">
          {query || category ? "Matching articles" : "Help articles"}
        </h2>
        {filtered.length > 0 ? <ul className="space-y-3">
          {filtered.map((article) => <li key={article.slug}>
            <Link to={helpArticlePath(article.slug)}
              className="flex gap-4 items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:border-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-cyan-700 mb-1">{article.category}</span>
                <span className="block text-base font-semibold text-foreground">{article.question}</span>
                <span className="block text-sm text-muted-foreground mt-1">{article.description}</span>
              </span>
              <ArrowRight className="w-5 h-5 shrink-0 text-cyan-600" aria-hidden="true" />
            </Link>
          </li>)}
        </ul> : <div className="rounded-2xl bg-card border border-border px-5 py-8 text-center text-foreground">
          <BookOpen className="w-7 h-7 text-cyan-600 mx-auto mb-3" aria-hidden="true" />
          <p className="font-semibold">No articles match that search.</p>
          <button type="button" className="mt-3 text-sm underline text-cyan-700"
            onClick={() => setParams({}, { replace: true })}>Clear search and filters</button>
        </div>}
      </section>

      <section aria-labelledby="connection-assistance" className="rounded-2xl border border-cyan-400/40 bg-cyan-50 p-5 text-slate-950">
        <h2 id="connection-assistance" className="flex gap-2 items-center text-lg font-semibold">
          <Link2 className="h-5 w-5 shrink-0" aria-hidden="true" />Need help connecting an account?
        </h2>
        <p className="mt-2 text-sm text-slate-800">External account connections are not active in this migration build. See which steps will need verification before publishing.</p>
        <Link to="/help/connect-another-platform"
          className="inline-flex min-h-11 items-center mt-3 rounded-xl bg-blue-800 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-900">
          Read connection guide <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      <section aria-labelledby="help-contact-heading" className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 id="help-contact-heading" className="text-xl font-semibold text-foreground">Still need help?</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Online support forms are not active yet. Contact the team by email; never include passwords or payment card details.
        </p>
        <a href="mailto:support@interplanetaryfund.com" className="inline-flex min-h-11 items-center mt-4 text-cyan-700 font-semibold underline underline-offset-4">
          Email IFund support <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </a>
      </section>
    </div>
  </div>;
}
