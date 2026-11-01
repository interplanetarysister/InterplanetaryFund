import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, LifeBuoy, Link2, ArrowRight, BookOpen, Rocket, Megaphone, HeartHandshake, Wallet, ShieldCheck, CreditCard, Bot, Users } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HELP_CATEGORIES, displayHelpCategory, helpArticlePath } from "@/lib/helpCenter";
import { CONNECTION_HELP_GUIDES } from "@/lib/connectionHelpGuides";
import { WORKFLOW_HELP_GUIDES } from "@/lib/workflowHelpGuides";

const CATEGORY_ICONS = { Rocket, Megaphone, HeartHandshake, Link2, Wallet, ShieldCheck, CreditCard, Bot, Users };

export default function Help() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    base44.entities.HelpArticle.list("-created_date", 500)
      .then((result) => { if (active) setArticles(Array.isArray(result) ? result : []); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    base44.auth.me().then((me) => { if (active) setUser(me); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const builtins = [...CONNECTION_HELP_GUIDES, ...WORKFLOW_HELP_GUIDES];
    return [...builtins, ...articles.filter(article => !builtins.some(guide => guide.slug === article.slug))].filter((article) => {
      if (category && displayHelpCategory(article.category) !== category) return false;
      if (!q) return true;
      return [article.question, article.answer, article.category, article.description, ...(article.keywords || [])]
        .join(" ").toLowerCase().includes(q);
    });
  }, [articles, category, query]);

  const submit = async (event) => {
    event.preventDefault();
    if (!user || !form.message.trim() || submitting) return;
    setSubmitting(true);
    setStatus("");
    try {
      const { data } = await base44.functions.invoke("createSupportTicket", {
        subject: form.subject.trim(), message: form.message.trim(),
      });
      if (data?.ok !== true) throw new Error("Support request rejected");
      setForm({ subject: "", message: "" });
      setShowForm(false);
      setStatus("Your support request was submitted.");
    } catch {
      setStatus("We couldn't submit your request. Please try again.");
    } finally { setSubmitting(false); }
  };

  return <div className="w-full min-w-0">
    <header className="bg-slate-950 text-white border-b border-cyan-500/20 px-4 sm:px-8 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-center mb-4"><LifeBuoy className="w-9 h-9 text-cyan-300" aria-hidden="true" /></div>
        <h1 className="font-display text-3xl sm:text-4xl text-center text-white">How can we help?</h1>
        <p className="text-slate-300 mt-2 text-center">The Interplanetary Fund Help Center</p>
        <label htmlFor="help-search" className="sr-only">Search IFund help articles</label>
        <div className="relative mt-7 max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" aria-hidden="true" />
          <Input id="help-search" value={query} onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="Search for answers…" className="min-h-12 pl-12 bg-white text-slate-950 placeholder:text-slate-500 border-slate-300" />
        </div>
      </div>
    </header>

    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-8">
      <section aria-labelledby="help-topics-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="help-topics-heading" className="font-display text-xl sm:text-2xl text-foreground">Browse by topic</h2>
          {category && <button type="button" className="text-sm font-semibold text-cyan-700 underline underline-offset-4" onClick={() => updateFilter("category", "")}>Show all topics</button>}
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
        <h2 id="help-legal-heading" className="text-xl font-semibold text-foreground">Legal documents & rights</h2>
        <p className="mt-2 text-sm text-muted-foreground">Public IFund agreements, privacy information, copyright and campaign permissions. No sign-in required.</p>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ["/help/terms-of-service", "Terms of Service"],
            ["/help/privacy-policy", "Privacy Policy"],
            ["/help/copyright-and-intellectual-property", "Copyright & Intellectual Property"],
            ["/help/campaign-authority-and-ai-permissions", "Campaign & AI Permissions"],
            ["/help/payment-holding-and-withdrawals", "Payments & Withdrawals"],
            ["/help/copyright-permissions-and-reporting", "Permissions & Infringement Reports"],
          ].map(([path, label]) => <li key={path}><Link to={path}
            className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 font-medium text-foreground hover:border-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500">
            {label}<ArrowRight className="h-4 w-4 shrink-0 text-cyan-600" />
          </Link></li>)}
        </ul>
      </section>

      <section aria-labelledby="help-connections-heading" className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 id="help-connections-heading" className="font-semibold text-xl">Using connections and AI</h2>
        <p className="text-sm text-muted-foreground">Simple, current steps for connecting apps, saving passwords, choosing permissions, and using your private verification inbox.</p>
        <div className="space-y-2">
          {CONNECTION_HELP_GUIDES.map(guide => <Link key={guide.slug} to={helpArticlePath(guide.slug)}
            className="block rounded-xl border border-border px-4 py-3 font-semibold hover:border-cyan-400">
            {guide.question} <ArrowRight className="inline w-4 h-4 text-cyan-600 ml-1" />
          </Link>)}
        </div>
      </section>
      <section aria-labelledby="help-articles-heading">
        <h2 id="help-articles-heading" className="font-display text-xl sm:text-2xl text-foreground mb-4">{query || category ? "Matching articles" : "Help articles"}</h2>
        {loading && <p className="text-muted-foreground" role="status">Loading help articles…</p>}
        {loadError && <div role="alert" className="rounded-xl border border-amber-400/60 p-4 text-foreground">We couldn't load the help articles. Try refreshing this page or contact support.</div>}
        {filtered.length > 0 && <ul className="space-y-3">
          {filtered.map((article) => <li key={article.id}>
            <Link to={helpArticlePath(article.slug || article.id)} className="flex gap-4 items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:border-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-cyan-700 mb-1">{displayHelpCategory(article.category)}</span>
                <span className="block text-base font-semibold text-foreground">{article.question}</span>
                {article.description && <span className="block text-sm text-muted-foreground mt-1">{article.description}</span>}
              </span>
              <ArrowRight className="w-5 h-5 shrink-0 text-cyan-600" aria-hidden="true" />
            </Link>
          </li>)}
        </ul>}
        {!loading && !loadError && filtered.length === 0 &&
          <div className="rounded-2xl bg-card border border-border px-5 py-8 text-center text-foreground">
            <BookOpen className="w-7 h-7 text-cyan-600 mx-auto mb-3" aria-hidden="true" />
            <p className="font-semibold">{articles.length === 0 ? "Our help articles are being prepared." : "No articles match that search."}</p>
            <p className="text-sm text-muted-foreground mt-2">You can still reach IFund support for assistance.</p>
            {(query || category) && <button type="button" className="mt-3 text-sm underline text-cyan-700" onClick={() => setSearchParams({}, { replace: true })}>Clear search and filters</button>}
          </div>}
      </section>

      <section aria-labelledby="connection-assistance" className="rounded-2xl border border-cyan-400/40 bg-cyan-50 p-5 text-slate-950">
        <h2 id="connection-assistance" className="flex gap-2 items-center text-lg font-semibold"><Link2 className="h-5 w-5 shrink-0" aria-hidden="true" />Need help connecting an account?</h2>
        <p className="mt-2 text-sm text-slate-800">Open IFund's connection helper to start or troubleshoot an external-account connection. Your provider may ask you to sign in or confirm access.</p>
        <Link to={user ? "/connections#connection-help" : "/login?returnTo=%2Fconnections%23connection-help"}
          className="inline-flex min-h-11 items-center mt-3 rounded-xl bg-blue-800 text-white font-semibold px-4 py-2 text-sm hover:bg-blue-900">
          {user ? "Open connection helper" : "Sign in to connect"} <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </section>

      <section aria-labelledby="help-contact-heading" className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 id="help-contact-heading" className="text-xl font-semibold text-foreground">Still need help?</h2>
        <p className="text-muted-foreground text-sm mt-1">Get help from IFund support, including payment or account problems.</p>
        {user ? <>
          <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => setShowForm((v) => !v)} aria-expanded={showForm}>Contact support</Button>
          {showForm && <form onSubmit={submit} className="mt-4 space-y-3 max-w-xl">
            <label htmlFor="help-subject" className="block text-sm font-semibold">Subject</label>
            <Input id="help-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={160} placeholder="What do you need help with?" />
            <label htmlFor="help-message" className="block text-sm font-semibold">Describe the problem</label>
            <Textarea id="help-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} required maxLength={5000} placeholder="Please don't include passwords or payment card numbers." />
            <Button type="submit" disabled={submitting || !form.message.trim()}>{submitting ? "Sending…" : "Send support request"}</Button>
          </form>}
        </> : <Link to="/contact" className="inline-flex items-center mt-4 text-cyan-700 font-semibold underline underline-offset-4">Contact IFund <ArrowRight className="ml-2 h-4 w-4" /></Link>}
        {status && <p role="status" className="mt-3 text-sm text-foreground">{status}</p>}
      </section>
    </div>
  </div>;
}
