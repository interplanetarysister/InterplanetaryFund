import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Heart, Bookmark, Repeat2, MessageCircle, Sparkles, Pin, Trash2, Share2 } from "lucide-react";
import { BannerBadge } from "@/components/social/ProfileBanner";

const PLATFORM_LABELS = {
  facebook: "Facebook", instagram: "Instagram", x: "X", tiktok: "TikTok",
  youtube: "YouTube", discord: "Discord", bluesky: "Bluesky", mastodon: "Mastodon",
  linkedin: "LinkedIn", threads: "Threads", reddit: "Reddit",
};

export default function PostCard({ post, currentUser, onLike, onSave, liked = false, saved = false, interestBusy = false, onDelete, onShare }) {
  const isOwner = currentUser?.id === post.author_user_id;
  const hasMedia = !!post.media_url;

  return (
    <div className={`glass-panel w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-4 sm:p-5 ${post.is_top_post ? "ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/10" : ""}`}>
      {post.is_top_post && (
        <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-medium mb-3">
          <Pin className="w-3.5 h-3.5" />
          Top Post
        </div>
      )}
      <div className="flex min-w-0 items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
          {(post.author_name || post.author_username || "?")[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link className="font-medium text-cyan-100 text-sm break-words hover:underline" to={`/u/${post.author_user_id}`}>{post.author_name || "Explorer"}</Link>
            {post.author_username && <span className="min-w-0 max-w-full break-all text-slate-400 text-xs">@{post.author_username}</span>}
            <BannerBadge tier={post.author_banner_tier} />
            {post.ai_generated && (
              <span className="inline-flex items-center gap-1 text-violet-300 text-[10px] font-medium">
                <Sparkles className="w-3 h-3" /> AI
              </span>
            )}
          </div>
          <p className="text-slate-300 text-sm mt-2 whitespace-pre-wrap break-words">{post.content}</p>
          {hasMedia && (
            <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
              {post.image_generated || (post.ai_generated && post.author_username === "interplanetaryfund") ? (
                <a href="https://interplanetaryfund.com" target="_blank" rel="noopener noreferrer"
                  aria-label="Visit Interplanetary Fund, source of this generated image">
                  <Image src={post.media_url} alt="Generated on Interplanetary Fund"
                    className="w-full max-h-96 object-cover" fittingType="fill" />
                </a>
              ) : (
                <Image src={post.media_url} alt="Post media" className="w-full max-h-96 object-cover" fittingType="fill" />
              )}
            </div>
          )}
          {post.campaign_id && (
            <Link to={`/campaign/${post.campaign_id}`} className="inline-flex items-center gap-1 mt-2 text-cyan-300 hover:text-cyan-200 text-xs">
              📌 {post.campaign_title || "View campaign"}
            </Link>
          )}
          {post.crosspost_platforms?.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-slate-500 text-[10px]">Shared to:</span>
              {post.crosspost_platforms.map((p) => (
                <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                  {PLATFORM_LABELS[p] || p}
                </span>
              ))}
            </div>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3 mt-3">
            <button type="button" aria-label={liked?"Unlike post":"Like post"} aria-pressed={liked} disabled={!currentUser?.id||interestBusy} onClick={() => onLike?.(post)} className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 text-xs transition-colors disabled:opacity-50">
              <Heart className="w-4 h-4" fill={liked?"currentColor":"none"} /> {post.likes_count || 0}
            </button>
            <button type="button" aria-label={saved?"Remove saved post":"Save post"} aria-pressed={saved} disabled={!currentUser?.id||interestBusy} onClick={() => onSave?.(post)} className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 text-xs transition-colors disabled:opacity-50">
              <Bookmark className="w-4 h-4" fill={saved?"currentColor":"none"} /> {saved?"Saved":"Save"}
            </button>
            <span className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Repeat2 className="w-4 h-4" /> {post.reposts_count || 0}
            </span>
            <span className="flex items-center gap-1.5 text-slate-400 text-xs">
              <MessageCircle className="w-4 h-4" /> {post.comments_count || 0}
            </span>
            {onShare && (
              <button onClick={() => onShare(post)} className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 text-xs transition-colors">
                <Share2 className="w-4 h-4" /> Share
              </button>
            )}
            {isOwner && onDelete && (
              <button onClick={() => onDelete(post)} className="ml-auto text-slate-500 hover:text-rose-400 text-xs transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}