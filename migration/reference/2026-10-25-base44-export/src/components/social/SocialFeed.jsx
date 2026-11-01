import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Radio, Sparkles } from "lucide-react";
import PostCard from "@/components/social/PostCard";

// Social feed with infinite scroll + realtime subscription for automated
// updates. New posts appear live; likes/deletes sync instantly.
export default function SocialFeed({ user, onShare }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [interests, setInterests] = useState({});
  const [changingInterest, setChangingInterest] = useState("");
  const [interestError, setInterestError] = useState("");
  const sentinelRef = useRef(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const [initial, interactions] = await Promise.all([
        base44.entities.SocialPost.list("-created_date", 20),
        user?.id ? base44.functions.invoke("managePostInterest", {mode:"list"}).catch(()=>null) : Promise.resolve(null),
      ]);
      setPosts(Array.isArray(initial) ? initial : []);
      setHasMore(Array.isArray(initial) && initial.length >= 20);
      const mapped = {};
      for (const item of interactions?.data?.interests||[]) mapped[item.post_id]={liked:item.liked===true,saved:item.saved===true};
      setInterests(mapped);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadInitial();
    // Realtime subscription — automated updates
    const unsubscribe = base44.entities.SocialPost.subscribe((event) => {
      if (event.type === "create") {
        setPosts((prev) => prev.some((p) => p.id === event.data.id) ? prev : [event.data, ...prev]);
      } else if (event.type === "update") {
        setPosts((prev) => prev.map((p) => (p.id === event.data.id ? event.data : p)));
      } else if (event.type === "delete") {
        setPosts((prev) => prev.filter((p) => p.id !== event.data.id));
      }
    });
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = posts[posts.length - 1]?.created_date;
      const query = oldest ? { created_date: { $lt: oldest } } : {};
      const more = await base44.entities.SocialPost.filter(query, "-created_date", 20);
      if (more.length < 20) setHasMore(false);
      setPosts((prev) => [...prev, ...more]);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [posts, loadingMore, hasMore]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleInterest = async (post, field) => {
    if (!user?.id || changingInterest) return;
    setChangingInterest(post.id);setInterestError("");
    try {
      const value = interests[post.id]?.[field] !== true;
      const response = await base44.functions.invoke("managePostInterest", {mode:"set",post_id:post.id,field,value});
      if (!response?.data?.ok) throw new Error("Not saved");
      const {liked,saved,likes_count} = response.data;
      setInterests(prev=>({...prev,[post.id]:{liked,saved}}));
      setPosts(prev=>prev.map(p=>p.id===post.id?{...p,likes_count}:p));
    } catch { setInterestError("Could not save your reaction. Refresh and try again."); }
    finally { setChangingInterest(""); }
  };

  const handleDelete = async (post) => {
    try {
      await base44.entities.SocialPost.delete(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch { /* best-effort */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  const topPosts = posts.filter((p) => p.is_top_post);
  const feedPosts = posts.filter((p) => !p.is_top_post);

  if (posts.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-10 text-center">
        <Radio className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-300 text-sm">No posts yet. Be the first to broadcast!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {interestError && <p role="alert" className="text-sm text-rose-400">{interestError}</p>}
      {topPosts.length > 0 && (
        <div>
          <p className="text-cyan-300 text-xs font-medium mb-2 px-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Top Posts
          </p>
          <div className="space-y-3">
            {topPosts.map((p) => (
              <PostCard key={p.id} post={p} currentUser={user} liked={!!interests[p.id]?.liked} saved={!!interests[p.id]?.saved} interestBusy={!!changingInterest} onLike={()=>handleInterest(p,"liked")} onSave={()=>handleInterest(p,"saved")} onDelete={handleDelete} onShare={onShare} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {feedPosts.map((p) => (
          <PostCard key={p.id} post={p} currentUser={user} liked={!!interests[p.id]?.liked} saved={!!interests[p.id]?.saved} interestBusy={!!changingInterest} onLike={()=>handleInterest(p,"liked")} onSave={()=>handleInterest(p,"saved")} onDelete={handleDelete} onShare={onShare} />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="py-4 flex justify-center">
        {loadingMore && <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />}
        {!hasMore && posts.length > 0 && (
          <p className="text-xs text-slate-600">You've reached the edge of the universe.</p>
        )}
      </div>
    </div>
  );
}