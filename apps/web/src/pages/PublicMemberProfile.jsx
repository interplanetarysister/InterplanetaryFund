import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UserRound } from "lucide-react";
import { avatarUrl, getPublicProfile } from "@/lib/memberProfile";
import { listPublicPosts } from "@/lib/publicSocialFeed";
import SocialPostList from "@/components/SocialPostList";
import { Image } from "@/components/ui/image";

export default function PublicMemberProfile() {
  const { id } = useParams();
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
