import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, BookOpen } from "lucide-react";
import { getReporterStory } from "../lib/blogs";

export default function BlogArticle() {
  const { id } = useParams();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getReporterStory(id).then((value) => { if (active) setStory(value); })
      .catch(() => { if (active) setError("This story could not be loaded right now."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  if (loading) return <main className="reporter-page">Loading story…</main>;
  if (error || !story) return <main className="reporter-page"><p role="alert">{error || "This story is not available."}</p><Link className="text-button" to="/blogs"><ArrowLeft size={15}/> Back to the Reporter</Link></main>;
  return <main className="reporter-page">
    <Link className="text-button" to="/blogs"><ArrowLeft size={15}/> All Reporter stories</Link>
    <article className="reporter-article">
      <header className="reporter-article-header"><p className="reporter-type"><BookOpen size={15}/> THE INTERPLANETARY FUND REPORTER</p><h1>{story.title}</h1>
        {story.summary && <p className="lede">{story.summary}</p>}
        <small><CalendarDays size={14}/>{story.published_at ? new Date(story.published_at).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}) : ""}</small>
      </header>
      <div className="reporter-story">{story.body}</div>
    </article>
  </main>;
}
