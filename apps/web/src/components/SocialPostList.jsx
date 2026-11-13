import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Flag, Share2 } from "lucide-react";
import { Image } from "@/components/ui/image";
import { getPostLikes, likePost, nativePostId, reportPost, readReplies, replyToPost } from "@/lib/socialCommunity";
import { useAuthSession } from "@/hooks/useAuthSession";

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

function SocialItem({ post, likes, onHidden, user }) {
  const id = nativePostId(post);
  const [liked, setLiked] = useState(likes?.liked || false);
  const [count, setCount] = useState(likes?.count || 0);
  const [working, setWorking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replies, setReplies] = useState([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setLiked(likes?.liked || false); setCount(likes?.count || 0); }, [likes?.liked, likes?.count]);

  async function toggleLike() {
    if (!id || !user || working) return;
    setWorking(true); setError("");
    try { await likePost(id, !liked); setCount(n => Math.max(0,n + (liked ? -1 : 1))); setLiked(v => !v); }
    catch (cause) { setError(cause.message); }
    finally { setWorking(false); }
  }
  async function submitReport(event) {
    event.preventDefault();
    if ((!id && !post.id?.startsWith("archive-")) || !user || working) return;
    setWorking(true); setError("");
    try { await reportPost(id || post.id, reason); setReportOpen(false); onHidden?.(post.id); }
    catch (cause) { setError(cause.message); }
    finally { setWorking(false); }
  }
  async function showReplies() {
    setReplyOpen(v => !v);
    if (!replyOpen && id) {
      try { setReplies(await readReplies(id)); }
      catch (cause) { setError(cause.message); }
    }
  }
  async function sendReply(event) {
    event.preventDefault();
    if (!id || working || !reply.trim()) return;
    setWorking(true); setError("");
    try { await replyToPost(id, reply); setReply(""); setReplies(await readReplies(id)); }
    catch (cause) { setError(cause.message); }
    finally { setWorking(false); }
  }

  return <article id={`post-${post.id}`} className="ifund-social-card space-y-3 rounded-2xl border border-border bg-card p-5">
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
    <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm">
      {id && <button type="button" disabled={!user || working} aria-pressed={liked} onClick={toggleLike} className="inline-flex min-h-11 items-center gap-2 text-primary disabled:opacity-50"><Heart size={17} fill={liked ? "currentColor" : "none"} /> {count} Likes</button>}
      {id && <button type="button" onClick={showReplies} className="inline-flex min-h-11 items-center gap-2 text-primary"><MessageCircle size={17} /> Replies</button>}
      <button type="button" className="inline-flex min-h-11 items-center gap-2 text-primary" onClick={() => sharePost(post)}><Share2 size={17} /> Share</button>
      {post.profile_id && <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/u/${post.profile_id}`}>View member</Link>}
      {(id || post.id?.startsWith("archive-")) && user && <button type="button" onClick={() => setReportOpen(v => !v)} className="ml-auto inline-flex min-h-11 items-center gap-1 text-muted-foreground"><Flag size={16} /> Report</button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {reportOpen && <form onSubmit={submitReport} className="space-y-2 rounded-xl border border-border p-3">
      <label htmlFor={`report-${post.id}`} className="block text-sm font-medium">Why are you reporting this post?</label>
      <textarea id={`report-${post.id}`} required minLength={15} maxLength={1500} rows={3} value={reason} onChange={e => setReason(e.target.value)}
        className="w-full rounded-lg border border-input bg-background p-3" />
      <p className="text-xs text-muted-foreground">Reports temporarily hide the post pending an administrator review. Misuse may be restricted.</p>
      <div className="flex gap-2"><button disabled={working || reason.trim().length < 15} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Submit report</button>
        <button type="button" onClick={() => setReportOpen(false)} className="rounded-lg border px-4 py-2">Cancel</button></div>
    </form>}
    {replyOpen && <div className="space-y-3 rounded-xl border border-border p-3">
      <h3 className="font-semibold">Public discussion</h3>
      {replies.map(item => <p key={item.id} className="break-words text-sm"><strong>{item.display_name || "IFund member"}:</strong> {item.body}</p>)}
      {!replies.length && <p className="text-sm text-muted-foreground">No replies yet.</p>}
      {user ? <form onSubmit={sendReply} className="flex flex-wrap gap-2">
        <input aria-label="Public reply" maxLength={1000} required value={reply} onChange={e => setReply(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3" placeholder="Join the discussion…" />
        <button disabled={working || !reply.trim()} className="rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">Reply</button>
      </form> : <Link className="text-primary underline" to="/login?returnTo=%2Fsocial">Sign in to reply</Link>}
    </div>}
  </article>;
}

export default function SocialPostList({ posts, onHidden }) {
  const { user } = useAuthSession();
  const [likes, setLikes] = useState({});
  useEffect(() => {
    let active = true;
    getPostLikes(posts).then(data => { if (active) setLikes(data); }).catch(() => { if (active) setLikes({}); });
    return () => { active = false; };
  }, [posts]);
  return posts.map(post => <SocialItem key={post.id} post={post} user={user} likes={likes[nativePostId(post)]} onHidden={onHidden} />);
}
