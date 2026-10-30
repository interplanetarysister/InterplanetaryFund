import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, ChevronRight, RefreshCw } from "lucide-react";
import { getReporterBlog, listPublishedBlogEntries } from "@/api/blogs";

const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

export default function Blogs() {
  const [blog, setBlog] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const [publication, stories] = await Promise.all([getReporterBlog(), listPublishedBlogEntries()]);
      setBlog(publication); setEntries(stories);
    } catch {
      setError("The Reporter stories could not be loaded. Please try again.");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-7 text-white shadow-xl sm:p-10">
      <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border border-cyan-200/20" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">The official IFund publication</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">{blog?.title || "The Interplanetary Fund Reporter"}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">{blog?.description || "The inside story of IFund: the ideas, the people, and the creative work of building a more connected fundraising community."}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-cyan-100"><BookOpen className="h-4 w-4" /> Stories, progress reports, and ideas from the IFund team</div>
      </div>
    </header>
    <div className="mt-9 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">From the newsroom</p><h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Latest stories</h2></div>
      <Link to="/my-blog" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-600 dark:text-slate-100">Reporter studio <ChevronRight className="h-4 w-4" /></Link>
    </div>
    {loading && <p className="py-12 text-center text-sm text-slate-500">Loading published stories…</p>}
    {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900" role="alert"><p>{error}</p><button onClick={load} className="mt-3 inline-flex items-center gap-2 font-semibold underline"><RefreshCw className="h-4 w-4" /> Retry</button></div>}
    {!loading && !error && entries.length === 0 && <p className="mt-6 rounded-2xl border border-slate-200 p-8 text-slate-600 dark:border-slate-700 dark:text-slate-300">The next story is on its way.</p>}
    {!loading && !error && entries.length > 0 && <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{entries.map((entry) => <article key={entry.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300"><BookOpen className="h-4 w-4" /> {entry.type === "newsletter" ? "Reporter dispatch" : "IFund story"}</div>
      <h3 className="mt-4 text-xl font-semibold leading-snug text-slate-900 dark:text-white">{entry.title}</h3>
      {entry.summary && <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{entry.summary}</p>}
      <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{dateLabel(entry.published_at)}</span><Link to={`/blogs/${encodeURIComponent(entry.id)}`} className="inline-flex min-h-9 items-center gap-1 font-semibold text-cyan-700 hover:underline dark:text-cyan-300">Read story <ChevronRight className="h-4 w-4" /></Link></div>
    </article>)}</div>}
  </main>;
}
