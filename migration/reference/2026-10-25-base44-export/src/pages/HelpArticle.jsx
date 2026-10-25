import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { displayHelpCategory } from "@/lib/helpCenter";
import { connectionHelpGuide } from "@/lib/connectionHelpGuides";
import { workflowHelpGuide } from "@/lib/workflowHelpGuides";

export default function HelpArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [user, setUser] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [feedbackError, setFeedbackError] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    const builtin = connectionHelpGuide(slug) || workflowHelpGuide(slug);
    if (builtin) {
      setArticle(builtin);
      setLoading(false);
      return () => { active = false; };
    }
    base44.entities.HelpArticle.filter({ slug }, "-created_date", 1)
      .then((rows) => { if (active) setArticle(Array.isArray(rows) ? rows[0] || null : null); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    if (!article?.id || String(article.id).startsWith("built-in-")) return;
    let active = true;
    base44.auth.me().then(async (me) => {
      if (!active || !me?.id) return;
      setUser(me);
      const records = await base44.entities.HelpFeedback.filter({ article_id: article.id, user_id: me.id }, "-created_date", 1);
      if (active) setFeedback(Array.isArray(records) ? records[0] || null : null);
    }).catch(() => {});
    return () => { active = false; };
  }, [article?.id]);
  const vote = async (helpful) => {
    if (!user?.id || !article?.id || savingFeedback) return;
    setSavingFeedback(true);
    setFeedbackError("");
    try {
      const value = feedback
        ? await base44.entities.HelpFeedback.update(feedback.id, { helpful })
        : await base44.entities.HelpFeedback.create({ article_id: article.id, user_id: user.id, helpful });
      setFeedback(value || { ...feedback, helpful });
    } catch {
      setFeedbackError("We couldn't save your feedback. Please try again.");
    } finally { setSavingFeedback(false); }
  };
  return <main className="max-w-3xl mx-auto px-4 sm:px-8 py-10 min-w-0 text-foreground">
    <Link to="/help" className="font-semibold text-cyan-700 underline">Back to Help Center</Link>
    {loading && <p role="status" className="mt-8">Loading article…</p>}
    {error && <p role="alert" className="mt-8">We couldn't load this article. Please try again.</p>}
    {!loading && !error && !article && <p className="mt-8">This article isn't available yet. <Link to="/contact" className="underline">Contact support</Link>.</p>}
    {!loading && !error && article && <article className="mt-8">
      <p className="text-sm font-semibold text-cyan-700">{displayHelpCategory(article.category)}</p>
      <h1 className="font-display text-3xl sm:text-4xl mt-2 break-words">{article.question}</h1>
      {article.description && <p className="text-muted-foreground mt-3">{article.description}</p>}
      <div className="border-t border-border my-7" />
      <div className="whitespace-pre-wrap leading-8 break-words">{article.answer}</div>
      {!String(article.id).startsWith("built-in-") && <section aria-labelledby="help-feedback-label" className="mt-10 border-t border-border pt-6">
        <h2 id="help-feedback-label" className="font-semibold">Was this article helpful?</h2>
        {user ? <div className="flex flex-wrap gap-3 mt-3">
          {[true, false].map((choice) => <button key={String(choice)} type="button" disabled={savingFeedback}
            aria-pressed={feedback?.helpful === choice} onClick={() => vote(choice)}
            className={"min-h-11 px-4 py-2 rounded-xl border font-medium " +
              (feedback?.helpful === choice ? "bg-cyan-50 border-cyan-500 text-slate-950" : "bg-card border-border text-foreground")}>
            {choice ? "Yes" : "No"}
          </button>)}
          {feedback && <p role="status" className="w-full text-sm text-muted-foreground">Thanks for your feedback.</p>}
        </div> : <p className="text-sm mt-2 text-muted-foreground">Sign in to rate articles, or contact us for more help.</p>}
        {feedbackError && <p className="text-sm text-red-700 mt-2" role="alert">{feedbackError}</p>}
      </section>}
      <div className="mt-8 rounded-xl border border-border p-5">
        <h2 className="font-semibold">Still need help?</h2>
        <Link to="/help" className="inline-block mt-3 font-semibold text-cyan-700 underline">Get support</Link>
      </div>
    </article>}
  </main>;
}
