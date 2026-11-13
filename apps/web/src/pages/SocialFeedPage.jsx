import "@/styles-sacred-social.css";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCampaignDetail } from "@/api/publicData";
import { getPublishedStory, getFinalPublication } from "@/lib/editorial";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { canMemberPost, publishPost, MAX_POST_LENGTH } from "@/lib/socialPosts.js";
import { FEED_PAGE_SIZE, listPublicPosts } from "@/lib/publicSocialFeed";
import SocialPostList from "@/components/SocialPostList";
import { loadServerSocialDraft, saveServerSocialDraft, clearServerSocialDraft } from "@/lib/socialCommunity";

export default function SocialFeedPage({ community = false }) {
  const [posts, setPosts] = useState([]);
  const [params] = useSearchParams();
  const campaignToShare = params.get("shareCampaign");
  const sharingUpdate = params.get("kind") === "update";
  const storyToShare = params.get("shareStory");
  const publicationToShare = params.get("sharePublication");
  const [hasMore, setHasMore] = useState(false);
  const { user, status } = useAuthSession();
  const [canPost, setCanPost] = useState(false);
  const [body, setBody] = useState("");
  const [shareSuggestion, setShareSuggestion] = useState("");
  const draftKey = user?.id ? `ifund-social-draft:${user.id}` : null;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (before) => {
    setLoading(true);
    setFeedError("");
    try {
      const data = await listPublicPosts({ before });
      setPosts(previous => before ? [...previous, ...data] : data);
      setHasMore(data.length === FEED_PAGE_SIZE);
    } catch {
      setFeedError("Posts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setCanPost(false);
    if (user) Promise.resolve().then(() => canMemberPost(authClient(), user))
      .then(gate => { if (active) setCanPost(gate.ok); })
      .catch(() => { if (active) setCanPost(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!draftKey) { setBody(""); return; }
    try { setBody(localStorage.getItem(draftKey) || ""); } catch { setBody(""); }
  }, [draftKey]);

  useEffect(() => {
    const id = campaignToShare;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    let active = true;
    setShareSuggestion("");
    getCampaignDetail(id).then(async campaign => {
      if (!active || !campaign) return;
      let ownerUpdate = false;
      if (sharingUpdate && user) {
        try {
          const { data, error } = await authClient().rpc("ifund_member_owns_active_campaign", { p_campaign: campaign.id });
          ownerUpdate = !error && data === true;
        } catch { /* Never imply ownership without verification */ }
      }
      if (!active) return;
      const url = `${window.location.origin}/campaign/${encodeURIComponent(campaign.id)}`;
      const intro = ownerUpdate ? `Campaign update: ${campaign.title}\n\n` : `Support ${campaign.title} on Interplanetary Fund!\n`;
      const suggested = `${intro}${url}`.slice(0, MAX_POST_LENGTH);
      setShareSuggestion(suggested);
      setBody(previous => previous || suggested);
    }).catch(() => {});
    return () => { active = false; };
  }, [campaignToShare, sharingUpdate, user?.id]);

  async function shareDraftExternally() {
    if (!body.trim()) return;
    const payload = { title: "Interplanetary Fund update", text: body.trim() };
    if (navigator.share) {
      try { await navigator.share(payload); setNotice("Your device accepted the share request. Check the destination before assuming it was published."); }
      catch (cause) { if (cause?.name !== "AbortError") setPublishError("External share was not completed."); }
      return;
    }
    try {
      await navigator.clipboard.writeText(body.trim());
      setNotice("Draft copied. Paste and publish it manually in the account you choose.");
    } catch {
      setPublishError("Copy was unavailable on this device.");
    }
  }

  useEffect(() => {
    const id = storyToShare;
    if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return;
    let active = true;
    getPublishedStory(id).then(story => {
      if (!active || !story) return;
      const url = `${window.location.origin}/blogs/${encodeURIComponent(story.id)}`;
      setBody(previous => previous || `Let's discuss: ${story.title}\n${url}`.slice(0,MAX_POST_LENGTH));
    }).catch(() => {});
    return () => { active = false; };
  }, [storyToShare]);

  useEffect(() => {
    const id = publicationToShare;
    if (!id || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return;
    let active = true;
    getFinalPublication(id).then(item => {
      if (!active || !item) return;
      const url = `${window.location.origin}/publications/${encodeURIComponent(item.id)}`;
      setBody(previous => previous || `Discuss this IFund update: ${item.title}\n${url}`.slice(0,MAX_POST_LENGTH));
    }).catch(() => {});
    return () => { active = false; };
  }, [publicationToShare]);

  useEffect(() => {
    if (!draftKey || !canPost) return;
    let active = true;
    loadServerSocialDraft().then(saved => {
      if (active && saved) setBody(previous => previous || saved);
    }).catch(() => {});
    return () => { active = false; };
  }, [draftKey, canPost]);

  async function saveDraft() {
    if (!draftKey || !body.trim()) return;
    let localSaved = false;
    try { localStorage.setItem(draftKey, body); localSaved = true; } catch { /* browser storage disabled */ }
    try {
      await saveServerSocialDraft(body);
      setNotice("Private draft saved to your IFund account. Not published or shared.");
    } catch {
      setNotice(localSaved
        ? "Draft saved on this device only. Account sync is unavailable; nothing was published."
        : "Draft could not be saved. Copy your text before leaving; nothing was published.");
    }
  }

  async function publish(event) {
    event.preventDefault();
    if (busy || !canPost || !body.trim()) return;
    setBusy(true);
    setPublishError("");
    setNotice("");
    try {
      await publishPost(authClient(), user, body);
      setBody("");
      try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* local storage unavailable */ }
      let cleared = true;
      try { await clearServerSocialDraft(); } catch { cleared = false; }
      setNotice(cleared
        ? "Post published to IFund. External accounts have not been posted to."
        : "Post published to IFund, but your account draft could not be cleared. External accounts were not posted to.");
      await load();
    } catch (cause) {
      setPublishError(cause?.message || "Your post was not published. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="ifund-sacred-social mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header>
      <h1 className="font-display text-3xl font-bold">{community ? "IFund Community" : "IFund Social Feed"}</h1>
      <p className="mt-2 text-muted-foreground">Share updates and discover community conversations.</p>
    </header>
    <nav aria-label="Community pages" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-primary underline">
      <Link to="/social" aria-current={community ? undefined : "page"}>Social Feed</Link>
      <Link to="/community" aria-current={community ? "page" : undefined}>Community</Link>
      <Link to="/blogs">Stories &amp; Blogs</Link>
      <Link to="/news">IFund Newscaster</Link>
    </nav>
    {canPost ? <form onSubmit={publish} className="space-y-3 rounded-2xl border border-border bg-card p-5">
      {shareSuggestion && body.trim() && !body.includes(shareSuggestion.split("\n").at(-1)) && <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <p>Your saved draft was preserved. Add this campaign to your post when you’re ready.</p>
        <button type="button" className="mt-2 min-h-11 text-primary underline" onClick={() => setBody(current => `${current.trim()}\n\n${shareSuggestion}`.slice(0,MAX_POST_LENGTH))}>Add campaign reference to draft</button>
      </div>}
      <label htmlFor="ifund-post" className="font-semibold">Share an update</label>
      <textarea id="ifund-post" required maxLength={MAX_POST_LENGTH} rows={4} value={body}
        onChange={e => setBody(e.target.value)} className="w-full rounded-xl border border-input bg-background p-3" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{body.length}/{MAX_POST_LENGTH}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !body.trim()} onClick={shareDraftExternally} className="min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">Share to another app</button>
          <button type="button" disabled={busy || !body.trim()} onClick={saveDraft} className="min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">Save draft</button>
          <button disabled={busy || !body.trim()} className="min-h-11 rounded-xl bg-primary px-5 text-primary-foreground disabled:opacity-50">{busy ? "Publishing…" : "Publish to IFund"}</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Drafts sync privately to your IFund account when available; otherwise they stay on this device. Manage external accounts under <Link className="underline" to="/connections">Connections</Link>; publishing here does not automatically post elsewhere.</p>
    </form> : status !== "loading" && <p className="rounded-xl border border-border p-4">
      {user ? "Posting requires a verified, active account." : <><Link className="text-primary underline" to="/login?returnTo=%2Fsocial">Sign in</Link> to share a post.</>}
    </p>}
    {publishError && <p role="alert" className="rounded-xl border border-destructive p-4">{publishError}</p>}
    {notice && <p role="status">{notice}</p>}
    <section aria-labelledby="recent-posts" className="space-y-4">
      <h2 id="recent-posts" className="text-xl font-semibold">Recent updates</h2>
      <SocialPostList posts={posts} onHidden={postId => setPosts(current => current.filter(post => post.id !== postId))} />
      {loading && <p role="status">Loading updates…</p>}
      {feedError && <p role="alert">{feedError} <button type="button" onClick={() => load(posts.at(-1))} className="min-h-11 text-primary underline">Retry</button></p>}
      {!loading && !feedError && posts.length === 0 && <p className="rounded-xl border border-border p-5 text-muted-foreground">No public updates yet.</p>}
      {!loading && !feedError && hasMore && <button type="button" className="min-h-11 rounded-xl border border-border px-4" onClick={() => load(posts.at(-1))}>Load older posts</button>}
    </section>
  </div>;
}
