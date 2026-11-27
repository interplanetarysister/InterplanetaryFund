import "@/styles-sacred-social.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCampaignDetail, listPublicVideoCampaigns } from "@/api/publicData";
import { unifiedSocialEntries } from "@/lib/unifiedSocialFeed.js";
import { publicShareOrigin } from "@/lib/campaignShare";
import { getPublishedStory, getFinalPublication } from "@/lib/editorial";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { canMemberPost, publishPost, MAX_POST_LENGTH } from "@/lib/socialPosts.js";
import { FEED_PAGE_SIZE, listPublicPosts } from "@/lib/publicSocialFeed";
import SocialPostList from "@/components/SocialPostList";
import CommunityDirectory from "@/components/community/CommunityDirectory";
import OrbitShorts from "@/pages/OrbitShorts";
import Blogs from "@/pages/Blogs";
import { loadServerSocialDraft, saveServerSocialDraft, clearServerSocialDraft } from "@/lib/socialCommunity";
import { listMyMedia, uploadMyMedia, validateLibraryFile } from "@/api/memberMedia";
import { socialComposeTargets } from "@/lib/socialComposeTargets.mjs";

// Sprint 8 (2026-11-25): IFund Social tabs (40-page list). Posts, Shorts,
// Stories and News live on this one page; /blogs and /news redirect here
// (see App.jsx). Stories renders the existing Blogs list and News renders
// its news variant — both fetch their own data, so this page adds no
// editorial fetching. Pattern follows MediaStudio/AgentsTeam: tab state
// lives in the URL (?tab=stories) so tabs are deep-linkable.
const SOCIAL_FEED_TABS = Object.freeze([
  { id: "posts", label: "Posts" },
  { id: "shorts", label: "Shorts" },
  { id: "stories", label: "Stories" },
  { id: "news", label: "News" },
]);

// Unknown or missing values fall back to the Posts feed.
function tabFromParam(value) {
  const found = SOCIAL_FEED_TABS.find((tab) => tab.id === String(value || "").toLowerCase());
  return found ? found.id : "posts";
}

export default function SocialFeedPage({ community = false }) {
  const [posts, setPosts] = useState([]);
  const [campaignVideos, setCampaignVideos] = useState([]);
  const [campaignFeedError, setCampaignFeedError] = useState(false);
  const timeline = useMemo(() => unifiedSocialEntries(posts, community ? [] : campaignVideos), [posts, campaignVideos, community]);
  const [params, setParams] = useSearchParams();
  const tab = tabFromParam(params.get("tab"));
  // Keep the compose params (?shareCampaign=, ?kind=, ?shareStory=,
  // ?sharePublication=) when switching tabs, as AgentsTeam does.
  function setTab(next) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", tabFromParam(next));
    setParams(nextParams, { replace: true });
  }
  // The Posts feed is the default view. The community variant has no
  // tablist (as before), so its feed is never wrapped as a tab panel.
  const showFeed = community || tab === "posts";
  const postsPanelProps = community
    ? {}
    : { role: "tabpanel", id: "social-panel-posts", "aria-labelledby": "social-tab-posts" };
  // One tablist shared by the Shorts branch and the main return. Four
  // min-h-11 (44px) buttons in a wrapping row: no horizontal overflow at
  // 320px, and the active/inactive pairing matches AgentsTeam
  // (bg-primary/text-primary-foreground vs bg-card) for contrast.
  const socialTabList = (
    <div role="tablist" aria-label="Social feed views" className="flex flex-wrap gap-2">
      {SOCIAL_FEED_TABS.map((item) => (
        <button key={item.id} type="button" role="tab" id={`social-tab-${item.id}`}
          aria-selected={tab === item.id} aria-controls={`social-panel-${item.id}`}
          className={`ifund-interactive min-h-11 rounded-xl border px-4 py-2 font-semibold ${tab === item.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
          onClick={() => setTab(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
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
  const [attachment, setAttachment] = useState(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState(null);

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
    if (community) return;
    let active = true;
    listPublicVideoCampaigns({ limit: 150 }).then(items => {
      if (active) { setCampaignVideos(items); setCampaignFeedError(false); }
    }).catch(() => { if (active) setCampaignFeedError(true); });
    return () => { active = false; };
  }, [community]);

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
      const url = `${publicShareOrigin(window.location.origin)}/campaign/${encodeURIComponent(campaign.id)}`;
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
      const url = `${publicShareOrigin(window.location.origin)}/blogs/${encodeURIComponent(story.id)}`;
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
      const url = `${publicShareOrigin(window.location.origin)}/publications/${encodeURIComponent(item.id)}`;
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

  async function attachFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || attachBusy) return;
    const invalid = validateLibraryFile(file);
    if (invalid) { setAttachError(invalid); return; }
    if (!["video", "image"].includes(file.type.split("/")[0])) {
      setAttachError("Attach a video or image file.");
      return;
    }
    setAttachBusy(true);
    setAttachError("");
    try {
      const saved = await uploadMyMedia(authClient(), file);
      setAttachment({ id: saved.id, name: file.name, kind: saved.kind });
      setLibraryOpen(false);
    } catch (cause) {
      setAttachError(cause?.message || "The file could not be uploaded.");
    } finally {
      setAttachBusy(false);
    }
  }

  async function toggleLibrary() {
    if (libraryOpen) { setLibraryOpen(false); return; }
    setLibraryOpen(true);
    if (libraryItems !== null) return;
    setAttachError("");
    try {
      const items = await listMyMedia(authClient());
      setLibraryItems(items.filter(item => ["video", "image"].includes(item.content_kind) && !item.deletion_requested_at));
    } catch (cause) {
      setLibraryItems([]);
      setAttachError(cause?.message || "Your media library could not be loaded.");
    }
  }

  async function publish(event) {
    event.preventDefault();
    if (busy || !canPost || !body.trim()) return;
    setBusy(true);
    setPublishError("");
    setNotice("");
    try {
      await publishPost(authClient(), user, body, attachment?.id ?? null);
      setAttachment(null);
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

  // The video feed is a view of Social, not a separate top-level destination.
  // Keep the existing /shorts deep link working through its route redirect.
  if (!community && tab === "shorts") return <div className="ifund-sacred-social mx-auto max-w-3xl space-y-5 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">IFund Social Feed</h1>
      <p className="mt-2 text-muted-foreground">Community posts and campaign videos in one place.</p></header>
    {socialTabList}
    <div role="tabpanel" id="social-panel-shorts" aria-labelledby="social-tab-shorts">
      <OrbitShorts />
    </div>
  </div>;

  return <div className="ifund-sacred-social mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header>
      <h1 className="font-display text-3xl font-bold">{community ? "IFund Community" : "IFund Social Feed"}</h1>
      <p className="mt-2 text-muted-foreground">Share updates and discover community conversations.</p>
    </header>
    {!community && socialTabList}
    <nav aria-label="Community pages" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-primary underline">
      <Link to="/social" aria-current={community ? undefined : "page"}>Social Feed</Link>
      <Link to="/community" aria-current={community ? "page" : undefined}>Community</Link>
      <Link to="/social?tab=shorts">Orbit Shorts</Link>
      <Link to="/social?tab=stories">Stories &amp; Blogs</Link>
      <Link to="/social?tab=news">IFund Newscaster</Link>
    </nav>
    {community && <section className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-card to-cyan-500/5 p-5" aria-label="Fund your Mission community opportunities">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Make progress on your goals</p>
      <h2 className="mt-2 text-xl font-bold">Fund your Mission</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Browse checked grants and resources, organize existing fundraisers, and see how sponsored earning opportunities are being developed. No paid sponsor tasks are available until their terms and funding are verified.</p>
      <Link to="/fund-your-mission" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 font-semibold text-primary">Explore funding opportunities</Link>
    </section>}
    {community && <CommunityDirectory />}
    {!community && tab === "stories" && <div role="tabpanel" id="social-panel-stories" aria-labelledby="social-tab-stories">
      <Blogs />
    </div>}
    {!community && tab === "news" && <div role="tabpanel" id="social-panel-news" aria-labelledby="social-tab-news">
      <Blogs news />
    </div>}
    {showFeed && <div {...postsPanelProps} className="space-y-6">
    {canPost ? <form onSubmit={publish} className="space-y-3 rounded-2xl border border-border bg-card p-5">
      {shareSuggestion && body.trim() && !body.includes(shareSuggestion.split("\n").at(-1)) && <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <p>Your saved draft was preserved. Add this campaign to your post when you’re ready.</p>
        <button type="button" className="mt-2 min-h-11 text-primary underline disabled:opacity-50" disabled={body.trim().length + 2 + shareSuggestion.length > MAX_POST_LENGTH} onClick={() => setBody(current => `${current.trim()}\n\n${shareSuggestion}`)}>Add campaign reference to draft</button>
      </div>}
      <label htmlFor="ifund-post" className="font-semibold">Share a post or video</label>
      <p className="text-xs text-muted-foreground">Attach your own uploaded video or image and it plays right here and in Shorts after publishing. You can also paste a public YouTube or Vimeo video link into your post. Media from connected external accounts is not imported without permission.</p>
      <textarea id="ifund-post" required maxLength={MAX_POST_LENGTH} rows={4} value={body}
        onChange={e => setBody(e.target.value)} className="w-full rounded-xl border border-input bg-background p-3" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{body.length}/{MAX_POST_LENGTH}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !body.trim()} onClick={shareDraftExternally} className="min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">Share to another app</button>
          <button type="button" disabled={busy || !body.trim()} onClick={saveDraft} className="min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">Save draft</button>
          <button disabled={busy || !body.trim()} className="ifund-interactive min-h-11 rounded-xl bg-primary px-5 text-primary-foreground disabled:opacity-50">{busy ? "Publishing…" : "Publish to IFund"}</button>
        </div>
      </div>
      <div className="space-y-2 rounded-xl border border-border p-3">
        <p className="text-sm font-medium">Attach media from your library</p>
        {attachment ? <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 break-words text-sm">{attachment.kind === "video" ? "Video" : "Image"} attached: <strong>{attachment.name}</strong>. It becomes public with this post; removing the post or deleting the file stops playback.</p>
          <button type="button" disabled={busy} onClick={() => setAttachment(null)} className="min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">Remove attachment</button>
        </div> : <div className="flex flex-wrap gap-2">
          <label className={`inline-flex min-h-11 items-center rounded-xl border border-border px-4 ${attachBusy ? "opacity-50" : "cursor-pointer"}`}>
            {attachBusy ? "Uploading…" : "Upload a video or image"}
            <input type="file" accept="video/mp4,video/webm,image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={attachBusy || busy} onChange={attachFile} />
          </label>
          <button type="button" disabled={attachBusy || busy} onClick={toggleLibrary} className="min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">{libraryOpen ? "Hide my library" : "Choose from my library"}</button>
        </div>}
        {attachError && <p role="alert" className="text-sm text-destructive">{attachError}</p>}
        {libraryOpen && !attachment && (libraryItems === null
          ? <p role="status" className="text-sm text-muted-foreground">Loading your library…</p>
          : libraryItems.length === 0
            ? <p className="text-sm text-muted-foreground">No videos or images in your library yet. Upload one above to attach it.</p>
            : <ul className="space-y-2">
                {libraryItems.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="min-w-0 break-words text-sm">{item.content_kind === "video" ? "Video" : "Image"} · {item.file_name}</span>
                  <button type="button" disabled={busy} onClick={() => { setAttachment({ id: item.id, name: item.file_name, kind: item.content_kind }); setLibraryOpen(false); }} className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">Attach</button>
                </li>)}
              </ul>)}
      </div>
      <div className="flex flex-wrap gap-3" aria-label="Review draft on another platform">
        {socialComposeTargets(body).map(target =>
          <a key={target.id} href={target.href} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-primary">
            {target.label}
          </a>
        )}
        {body.trim() && socialComposeTargets(body).length === 0 &&
          <p className="text-xs text-muted-foreground">This draft exceeds X and Bluesky's short-post limits. Use Share to another app or shorten the draft without losing your text.</p>}
      </div>
      <p className="text-xs text-muted-foreground">External compose links open a review screen in your own network account. Nothing is submitted until you publish there.</p>
      <p className="text-xs text-muted-foreground">Drafts sync privately to your IFund account when available; otherwise they stay on this device. Manage external accounts under <Link className="underline" to="/connections">Connections</Link>; publishing here does not automatically post elsewhere.</p>
    </form> : status !== "loading" && <p className="rounded-xl border border-border p-4">
      {user ? "Posting requires a verified, active account." : <><Link className="text-primary underline" to="/login?returnTo=%2Fsocial">Sign in</Link> to share a post.</>}
    </p>}
    {publishError && <p role="alert" className="ifund-feedback-error">{publishError}</p>}
    {notice && <p role="status" className="ifund-feedback-success">{notice}</p>}
    <section aria-labelledby="recent-posts" className="space-y-4">
      <h2 id="recent-posts" className="text-xl font-semibold">{community ? "Recent updates" : "Public timeline"}</h2>
      {!community && <p className="text-sm text-muted-foreground">Public IFund and member posts, images, campaign updates, and supported videos together. External network content appears only when publicly available through an approved IFund source.</p>}
      {!community && campaignFeedError && <p role="status" className="text-sm text-muted-foreground">Campaign videos could not be loaded. Community posts are still available.</p>}
      <SocialPostList posts={timeline} onHidden={postId => setPosts(current => current.filter(post => post.id !== postId))} />
      {loading && <p role="status" className="ifund-feedback-loading">Loading updates…</p>}
      {feedError && <p role="alert" className="ifund-feedback-error">{feedError} <button type="button" onClick={() => load(posts.at(-1))} className="min-h-11 text-primary underline">Retry</button></p>}
      {!loading && !feedError && timeline.length === 0 && <p className="rounded-xl border border-border p-5 text-muted-foreground">No public updates yet.</p>}
      {!loading && !feedError && hasMore && <button type="button" className="min-h-11 rounded-xl border border-border px-4" onClick={() => load(posts.at(-1))}>Load older posts</button>}
    </section>
    </div>}
  </div>;
}
