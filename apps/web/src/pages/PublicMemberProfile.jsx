import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UserRound } from "lucide-react";
import { avatarUrl, getPublicProfile } from "@/lib/memberProfile";
import { listPublicPosts } from "@/lib/publicSocialFeed";
import SocialPostList from "@/components/SocialPostList";
import { Image } from "@/components/ui/image";
import { useAuthSession } from "@/hooks/useAuthSession";
import { friendAction, friendStatus } from "@/lib/socialCommunity";

export default function PublicMemberProfile() {
  const { id } = useParams();
  const { user } = useAuthSession();
  const [friend, setFriend] = useState("");
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendError, setFriendError] = useState("");
  useEffect(() => {
    let active = true;
    if (user && user.id !== id) friendStatus(id).then(status => { if(active) setFriend(status || "none"); }).catch(() => { if(active) setFriend("none"); });
    return () => { active=false; };
  }, [id,user?.id]);
  async function changeFriend(action) {
    setFriendBusy(true); setFriendError("");
    try {
      await friendAction(id, action);
      setFriend(action === "request" ? "sent" : action === "accept" ? "friends" : "none");
    } catch (cause) { setFriendError(cause.message); }
    finally { setFriendBusy(false); }
  }
  const [profile, setProfile] = useState(undefined);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [postError, setPostError] = useState("");

  useEffect(() => {
    let active = true;
    setProfile(undefined);
    setPosts([]);
    setError("");
    setPostError("");
    getPublicProfile(id).then(async data => {
      if (!active) return;
      setProfile(data);
      if (!data?.show_posts) return;
      try {
        const updates = await listPublicPosts({ author: data.id });
        if (active) setPosts(updates);
      } catch {
        if (active) setPostError("Recent posts could not be loaded.");
      }
    }).catch(() => { if (active) setError("The profile could not be loaded."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <p role="alert" className="p-8">{error}</p>;
  if (profile === undefined) return <p role="status" className="p-8">Loading member profile…</p>;
  if (!profile) return <div className="mx-auto max-w-3xl space-y-4 p-8">
    <h1 className="text-2xl font-bold">Profile unavailable</h1>
    <p>This profile may be private.</p>
    <Link className="text-primary underline" to="/social">Browse IFund Social</Link>
  </div>;

  return <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
    <header className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        {profile.avatar_key
          ? <Image src={avatarUrl(profile.id, profile.avatar_key)} alt="" className="size-16 rounded-full object-cover" />
          : <UserRound aria-hidden="true" className="size-16 rounded-full border border-border p-3" />}
        <div className="min-w-0 break-words">
          <h1 className="font-display text-3xl font-bold">{profile.display_name || "IFund member"}</h1>
          {profile.handle && <p className="text-muted-foreground">@{profile.handle}</p>}
        </div>
      </div>
      {profile.bio && <p className="whitespace-pre-wrap break-words">{profile.bio}</p>}
      {user && user.id !== id && <div className="flex flex-wrap gap-2">
        {friend === "none" && <button disabled={friendBusy} onClick={() => changeFriend("request")} className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">Add friend</button>}
        {friend === "sent" && <><span className="self-center text-sm text-muted-foreground">Friend request sent</span><button disabled={friendBusy} onClick={() => changeFriend("remove")} className="rounded-xl border px-4 py-3">Cancel request</button></>}
        {friend === "received" && <><button disabled={friendBusy} onClick={() => changeFriend("accept")} className="rounded-xl bg-primary px-4 py-3 text-primary-foreground">Accept friend request</button><button disabled={friendBusy} onClick={() => changeFriend("decline")} className="rounded-xl border px-4 py-3">Decline</button></>}
        {friend === "friends" && <><span className="self-center text-sm">Friends</span><button disabled={friendBusy} onClick={() => changeFriend("remove")} className="rounded-xl border px-4 py-3">Remove friend</button></>}
      </div>}
      {friendError && <p role="alert" className="text-sm text-destructive">{friendError}</p>}
    </header>
    {profile.campaigns.length > 0 && <section aria-labelledby="featured-campaigns" className="space-y-3">
      <h2 id="featured-campaigns" className="text-xl font-semibold">Featured campaigns</h2>
      {profile.campaigns.map(campaign => <Link to={`/campaign/${campaign.id}`} key={campaign.id} className="block rounded-2xl border border-border bg-card p-5 hover:border-primary">
        <h3 className="font-semibold text-primary">{campaign.title}</h3>
        <p className="mt-2 line-clamp-3">{campaign.summary}</p>
      </Link>)}
    </section>}
    {profile.show_posts && <section aria-labelledby="profile-posts" className="space-y-3">
      <h2 id="profile-posts" className="text-xl font-semibold">Recent posts</h2>
      {postError && <p role="alert">{postError}</p>}
      <SocialPostList posts={posts} />
    </section>}
    <Link className="inline-flex min-h-11 items-center text-primary underline" to={`/blogs?author=${profile.id}`}>Read this member’s stories</Link>
  </div>;
}
