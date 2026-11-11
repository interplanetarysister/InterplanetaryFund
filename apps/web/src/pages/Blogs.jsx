import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Newspaper, Radio } from "lucide-react";
import { listFinalPublications, listPublishedStories } from "@/lib/editorial";
import { Image } from "@/components/ui/image";

export default function Blogs({ news = false }) {
  const [params] = useSearchParams();
  const author = news ? "" : params.get("author") || "";
  const [result, setResult] = useState({ loading: true });
  const [revision, retry] = useState(0);

  const load = useCallback(async () => {
    const [stories, publications] = await Promise.allSettled([
      listPublishedStories({ author }),
      news ? listFinalPublications() : Promise.resolve([]),
    ]);
    return { stories, publications, loading: false };
  }, [author, news]);

  useEffect(() => {
    let active = true;
    setResult({ loading: true });
    load().then(data => { if (active) setResult(data); });
    return () => { active = false; };
  }, [load, revision]);

  const stories = result.stories?.value || [];
  const reporter = stories.filter(entry => entry.blog.type === "official");
  const community = stories.filter(entry => entry.blog.type !== "official");
  const publications = result.publications?.value || [];
  const hasError = result.stories?.status === "rejected" || result.publications?.status === "rejected";

  return <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
    <header>
      <h1 className="font-display text-3xl font-bold">{news ? "IFund Newscaster" : "IFund Stories & Blogs"}</h1>
      <p className="mt-2 text-muted-foreground">{news ? "Official updates, newsletters, and announcements from Interplanetary Fund." : "Member stories, fundraising ideas, and the Interplanetary Fund Reporter."}</p>
    </header>
    <nav aria-label="Editorial pages" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-primary underline">
      <Link to="/blogs" aria-current={news ? undefined : "page"}>Stories &amp; Blogs</Link>
      <Link to="/news" aria-current={news ? "page" : undefined}>Newscaster</Link>
      <Link to="/my-blog">My Blog</Link>
      <Link to="/social">IFund Social</Link>
    </nav>
    {author && <Link to="/blogs" className="text-primary underline">See all stories</Link>}
    {result.loading && <p role="status">Loading stories…</p>}
    {hasError && <p role="alert">Some content could not be loaded. <button type="button" className="min-h-11 text-primary underline" onClick={() => retry(n => n + 1)}>Retry</button></p>}
    {result.stories?.status === "fulfilled" && <>
      {(!author || reporter.length > 0) && <StorySection title="Interplanetary Fund Reporter" icon={Newspaper}
        entries={reporter} empty="No published reporter stories yet." />}
      {!news && <StorySection title="Community Blogs" icon={BookOpen}
        entries={community} empty="No published member stories yet." />}
    </>}
    {news && result.publications?.status === "fulfilled" && <section aria-labelledby="publications-heading" className="space-y-3">
      <h2 id="publications-heading" className="flex items-center gap-2 text-xl font-semibold"><Radio aria-hidden="true" /> Official publications</h2>
      {publications.length ? <div className="grid gap-4 sm:grid-cols-2">{publications.map(item =>
        <Link className="block rounded-2xl border border-border bg-card p-5 hover:border-primary" key={item.id} to={`/publications/${encodeURIComponent(item.id)}`}>
          <h3 className="break-words text-lg font-semibold">{item.title}</h3>
          {item.summary && <p className="mt-2 line-clamp-3 text-muted-foreground">{item.summary}</p>}
        </Link>
      )}</div> : <p className="text-muted-foreground">No approved announcements or reports are available yet.</p>}
    </section>}
  </div>;
}

function StorySection({ title, icon: Icon, entries, empty }) {
  return <section className="space-y-3">
    <h2 className="flex items-center gap-2 text-xl font-semibold"><Icon aria-hidden="true" /> {title}</h2>
    {entries.length ? <div className="grid gap-4 sm:grid-cols-2">{entries.map(entry =>
      <Link key={entry.id} to={`/blogs/${encodeURIComponent(entry.id)}`} className="block rounded-2xl border border-border bg-card p-5 hover:border-primary">
        {entry.blog.cover_image_url && <Image src={entry.blog.cover_image_url} alt="" loading="lazy" className="mb-3 h-36 w-full rounded-xl object-cover" />}
        <p className="text-xs font-semibold uppercase text-primary">{entry.type === "newsletter" ? "Newsletter" : entry.blog.title}</p>
        <h3 className="mt-2 break-words text-lg font-semibold">{entry.title}</h3>
        {entry.summary && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{entry.summary}</p>}
        {entry.published_at && <time className="mt-3 block text-xs text-muted-foreground" dateTime={entry.published_at}>{new Date(entry.published_at).toLocaleDateString()}</time>}
      </Link>
    )}</div> : <p className="text-muted-foreground">{empty}</p>}
  </section>;
}
