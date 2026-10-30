import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, BookOpen } from "lucide-react";
import { getPublishedBlogEntry } from "@/api/blogs";

export default function BlogArticle() {
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getPublishedBlogEntry(id).then((value) => { if (active) setEntry(value); })
      .catch(() => { if (active) setError("This story could not be loaded right now."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  if (loading) return <main className="mx-auto max-w-3xl px-4 py-12 text-slate-500">Loading story…</main>;
  if (error || !entry) return <main className="mx-auto max-w-3xl px-4 py-12"><p role="alert" className="text-slate-600 dark:text-slate-300">{error || "This story is not available."}</p><Link to="/blogs" className="mt-5 inline-flex min-h-10 items-center gap-2 text-cyan-700 underline"><ArrowLeft className="h-4 w-4" /> Back to the Reporter</Link></main>;
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
    <Link to="/blogs" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-300"><ArrowLeft className="h-4 w-4" /> All Reporter stories</Link>
    <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200"><BookOpen className="h-4 w-4" /> The Interplanetary Fund Reporter</p>
        <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{entry.title}</h1>
        {entry.summary && <p className="mt-4 text-base leading-7 text-slate-200">{entry.summary}</p>}
        <p className="mt-5 inline-flex items-center gap-2 text-xs text-cyan-100"><CalendarDays className="h-4 w-4" />{entry.published_at ? new Date(entry.published_at).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}) : ""}</p>
      </header>
      <div className="px-6 py-8 sm:px-10 sm:py-10"><div className="whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700 dark:text-slate-200">{entry.body}</div></div>
    </article>
  </main>;
}
