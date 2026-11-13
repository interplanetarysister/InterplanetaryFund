import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicSocialPost } from "@/lib/publicSocialFeed";
import SocialPostList from "@/components/SocialPostList";
import "@/styles-sacred-social.css";

export default function SocialPostPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [phase, setPhase] = useState("loading");
  useEffect(() => {
    let active = true;
    setPhase("loading"); setPost(null);
    getPublicSocialPost(id)
      .then(value => {
        if (!active) return;
        setPost(value);
        setPhase(value ? "ready" : "missing");
      })
      .catch(() => { if (active) setPhase("error"); });
    return () => { active = false; };
  }, [id]);
  return <main className="ifund-sacred-social mx-auto max-w-3xl space-y-5 px-4 py-8">
    <Link to="/social" className="inline-flex min-h-11 items-center text-primary underline">Back to Social Feed</Link>
    {phase === "loading" && <p role="status">Loading community post…</p>}
    {phase === "missing" && <p>This post is unavailable or has been hidden for moderation.</p>}
    {phase === "error" && <p role="alert">This post could not be loaded.</p>}
    {phase === "ready" && post && <SocialPostList posts={[post]} onHidden={() => { setPost(null); setPhase("missing"); }} />}
  </main>;
}
