import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search, LifeBuoy, Link2, ArrowRight, BookOpen, Rocket,
  Megaphone, HeartHandshake, Wallet, ShieldCheck, CreditCard, Bot, Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { HELP_CATEGORIES, helpArticlePath } from "@/lib/helpCenter";
import { helpArticles } from "@/lib/helpArticles";
import { parsePublicHelpIndex } from "@/lib/studioHelpContent.mjs";
import { useAuthSession } from "@/hooks/useAuthSession";
import SupportTickets from "./SupportTickets";

const CATEGORY_ICONS = { Rocket, Megaphone, HeartHandshake, Link2, Wallet, ShieldCheck, CreditCard, Bot, Users };

// Sprint 8 (2026-11-25): the Help Center is the single tabbed page for
// public help and member support tickets (40-page list). "Help articles"
// is the entire pre-existing Help content; "Tickets" reuses the existing
// SupportTickets page — no second ticket form is built here.
export const HELP_TABS = Object.freeze([
  { id: "help", label: "Help articles" },
  { id: "tickets", label: "Support tickets" },
]);

// Tab state lives in the URL (?tab=tickets) so Help tabs are deep-linkable.
// Unknown or missing values fall back to Help articles.
export function tabFromParam(value) {
  const found = HELP_TABS.find((tab) => tab.id === String(value || "").toLowerCase());
  return found ? found.id : "help";
}

export default function Help() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParam(params.get("tab"));
  const { user, status: authStatus } = useAuthSession();
  const query = params.get("q") || "";
  const category = params.get("category") || "";
  const [publishedAnswers, setPublishedAnswers] = useState({});
  const [updates, setUpdates] = useState("loading");
  useEffect(() => {
    let active = true;
    fetch("/api/public/help/index", { method: "GET", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Published Help Center updates are unavailable.");
        return parsePublicHelpIndex(await response.json(), helpArticles.map(article => article.slug));
      })
      .then(answers => { if (active) { setPublishedAnswers(answers); setUpdates("ready"); } })
      .catch(() => { if (active) setUpdates("unavailable"); });
    return () => { active = false; };
  }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return helpArticles.filter((article) => {
      if (category && article.category !== category) return false;
      return !q || [article.question, article.description, publishedAnswers[article.slug] || article.answer, article.category]
        .join(" ").toLocaleLowerCase().includes(q);
    });
  }, [query, category, publishedAnswers]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  // Switching tabs keeps the other query parameters (?q=, ?category=,
  // ?request=delete-account) so a search or a deletion request survives
  // the switch and is restored when returning to the Help tab.
  function setTab(next) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", tabFromParam(next));
    setParams(nextParams, { replace: true });
  }

  // The tickets panel used to sit behind the Member gate on /support, and
  // /help is public — so SupportTickets must not mount for signed-out
  // visitors. While the session is resolving, show a loading state so the
  // panel does not fire owner-scoped reads as anonymous; signed-out
  // visitors get a sign-in card instead of the panel.
  function ticketsPanel() {
    if (authStatus === "loading")
      return <p role="status" className="mx-auto max-w-5xl px-4 sm:px-8 py-8 text-sm text-muted-foreground">Checking your account…</p>;
    if (!user) return <HelpTicketsSignIn />;
    return <SupportTickets />;
  }

  return <div className="w-full min-w-0">
    {updates === "unavailable" && <p role="status" className="mx-auto max-w-5xl px-4 py-2 text-xs text-muted-foreground">Recent Help Center updates could not be checked; search uses bundled guidance.</p>}
    <header className="bg-slate-950 text-white border-b border-cyan-500/20 px-4 sm:px-8 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-center mb-4">
          <LifeBuoy className="w-9 h-9 text-cyan-300" aria-hidden="true" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl text-center text-white">How can we help?</h1>
        <p className="text-slate-300 mt-2 text-center">The Interplanetary Fund Help Center</p>
        {tab === "help" && <>
        <label htmlFor="help-search" className="sr-only">Search iFund help articles</label>
        <div className="relative mt-7 max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" aria-hidden="true" />
          <Input id="help-search" type="search" value={query}
            onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="Search for answers…"
            className="min-h-12 pl-12 bg-white text-slate-950 placeholder:text-slate-500 border-slate-300" />
        </div>
        </>}
      </div>
    </header>

    <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8">
      <div role="tablist" aria-label="Help Center sections" className="flex flex-wrap gap-2">
        {HELP_TABS.map((item) => (
          <button key={item.id} type="button" role="tab" id={`help-tab-${item.id}`}
            aria-selected={tab === item.id} aria-controls={`help-panel-${item.id}`}
            className={`ifund-interactive min-h-11 rounded-xl border px-4 py-2 font-semibold ${tab === item.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
            onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
    </div>

    {tab === "help" && <div role="tabpanel" id="help-panel-help" aria-labelledby="help-tab-help" className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
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
          Public iFund agreements and privacy information. No sign-in required.
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
          {helpArticles.filter(a => ["Connections & Publishing", "AI Assistance"].includes(a.category)).map((article) =>
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
          Signed-in members can open a support ticket and track its status. Public email contact remains available; never include passwords, authentication codes, or card details.
        </p>
        <Link to="/help?tab=tickets" className="inline-flex min-h-11 items-center mt-4 mr-4 text-cyan-700 font-semibold underline underline-offset-4">Open a support ticket <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Link>
        <a href="mailto:support@interplanetaryfund.com" className="inline-flex min-h-11 items-center mt-4 text-cyan-700 font-semibold underline underline-offset-4">
          Email IFund support <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </a>
      </section>
    </div>}

    {tab === "tickets" && <div role="tabpanel" id="help-panel-tickets" aria-labelledby="help-tab-tickets">
      {ticketsPanel()}
    </div>}
  </div>;
}

// Signed-out visitors on the tickets tab get a sign-in card instead of the
// SupportTickets panel (same pattern as the AgentsTeam member tabs). The
// return link brings them back to the tickets tab after signing in.
function HelpTicketsSignIn() {
  return <section className="mx-auto max-w-5xl px-4 sm:px-8 py-8" aria-label="Sign in to view support tickets">
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Sign in to view support tickets</h2>
      <p className="text-sm text-muted-foreground">Support tickets are private to your account. Sign in to open a ticket and track its status — nothing here is shared with other accounts.</p>
      <Link className="inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700" to={`/login?returnTo=${encodeURIComponent("/help?tab=tickets")}`}>Sign in</Link>
    </div>
  </section>;
}
