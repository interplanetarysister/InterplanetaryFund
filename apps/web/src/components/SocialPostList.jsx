import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";

async function sharePost(post) {
  const url = `${window.location.origin}/social#post-${encodeURIComponent(post.id)}`;
  const data = { title: "Interplanetary Fund community update", text: post.body, url };
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (error) { if (error?.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(`${post.body}\n${url}`); }
  catch { window.prompt("Copy this community update:", `${post.body}\n${url}`); }
}

export default function SocialPostList({ posts }) {
  return posts.map(post => <article id={`post-${post.id}`} key={post.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="min-w-0 break-words font-semibold">
        {post.profile_id
          ? <Link className="text-primary underline" to={`/u/${post.profile_id}`}>{post.display_name || "IFund member"}</Link>
          : post.display_name || "IFund member"}
        {post.source_platform === "bluesky" && <span className="ml-2 font-normal text-muted-foreground">via Bluesky</span>}
      </p>
      {post.posted_at && <time className="text-xs text-muted-foreground" dateTime={post.posted_at}>{new Date(post.posted_at).toLocaleDateString()}</time>}
    </div>
    <p className="whitespace-pre-wrap break-words">{post.body}</p>
    {post.media_url && <Image src={post.media_url} alt="Image shared with this post" loading="lazy"
      className="max-h-96 w-full rounded-xl object-contain" />}
    {post.external_url && <a href={post.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary underline">View original post</a>}
    <div className="flex flex-wrap gap-3 border-t border-border pt-3 text-sm">
      <button type="button" className="min-h-11 text-primary underline" onClick={() => sharePost(post)}>Share update</button>
      {post.profile_id && <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/u/${post.profile_id}`}>View member</Link>}
    </div>
  </article>);
}
