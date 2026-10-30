import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, RefreshCw } from "lucide-react";
import { getReporterBlog, listReporterStories } from "../lib/blogs";

const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";

export default function Blogs() {
  const [blog, setBlog] = useState(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const [publication, entries] = await Promise.all([getReporterBlog(), listReporterStories()]);
      setBlog(publication); setStories(entries);
    } catch { setError("The Reporter stories could not be loaded. Please try again."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  return <main className="reporter-page">
    <section className="reporter-hero">
      <p className="eyebrow">THE OFFICIAL IFUND PUBLICATION</p>
      <h1>{blog?.title || "The Interplanetary Fund Reporter"}</h1>
      <p>{blog?.description || "The inside story of IFund: the ideas, the people, and the creative work of building a more connected fundraising community."}</p>
      <div className="reporter-byline"><BookOpen size={17} /> Stories, progress reports, and ideas from the IFund team</div>
    </section>
    <div className="reporter-heading"><div><p className="eyebrow">FROM THE NEWSROOM</p><h2>Latest stories</h2></div><Link className="secondary" to="/my-blog">Reporter studio</Link></div>
    {loading && <p>Loading published stories…</p>}
    {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={load}><RefreshCw size={15}/> Retry</button></div>}
    {!loading && !error && !stories.length && <p className="card">The next story is on its way.</p>}
    {!loading && !error && stories.length > 0 && <div className="reporter-grid">{stories.map((story) => <article className="card reporter-card" key={story.id}>
      <p className="reporter-type"><BookOpen size={15}/>{story.type === "newsletter" ? "REPORTER DISPATCH" : "IFUND STORY"}</p>
      <h3>{story.title}</h3>
      {story.summary && <p>{story.summary}</p>}
      <div className="reporter-card-footer"><small><CalendarDays size={14}/>{dateLabel(story.published_at)}</small><Link to={`/blogs/${encodeURIComponent(story.id)}`}>Read story →</Link></div>
    </article>)}</div>}
  </main>;
}
