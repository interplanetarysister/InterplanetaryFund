import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Pin, Trash2, Heart, Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CampaignUpdates({ campaign }) {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [comments, setComments] = useState([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const isCreator = user && campaign.created_by_id === user.id;

  const load = async () => {
    try {
      const [u, c] = await Promise.all([
        base44.entities.CampaignUpdate.filter({ campaign_id: campaign.id }, '-created_date', 100),
        base44.entities.Comment.filter({ campaign_id: campaign.id }, '-created_date', 100),
      ]);
      setUpdates(u);
      setComments(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, [campaign.id]);

  const sortedUpdates = [...updates].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const postUpdate = async () => {
    if (!newUpdate.trim()) return;
    setPosting(true);
    try {
      await base44.entities.CampaignUpdate.create({
        campaign_id: campaign.id,
        author_name: user?.full_name || user?.email || 'Organizer',
        content: newUpdate.trim(),
        pinned: false,
      });
      try {
        const followers = await base44.entities.Follow.filter({ campaign_id: campaign.id }, '-created_date', 500);
        if (followers.length > 0) {
          await base44.entities.Notification.bulkCreate(
            followers.map((f) => ({ recipient_id: f.follower_id, type: 'update', message: `New update on "${campaign.title}"`, link: `/campaign/${campaign.id}`, read: false }))
          );
        }
      } catch {}
      setNewUpdate('');
      await load();
      toast({ title: 'Update posted', variant: 'success' });
    } catch (e) {
      toast({ title: 'Could not post update', description: e.message, variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const togglePin = async (upd) => {
    try {
      await base44.entities.CampaignUpdate.update(upd.id, { pinned: !upd.pinned });
      await load();
    } catch (e) {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const deleteUpdate = async (upd) => {
    try {
      await base44.entities.CampaignUpdate.delete(upd.id);
      await load();
    } catch (e) {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !user) return;
    setPosting(true);
    try {
      const name = user.full_name || user.email || 'Supporter';
      await base44.entities.Comment.create({
        campaign_id: campaign.id,
        author_name: name,
        content: newComment.trim(),
        likes: 0,
        liked_by: [],
      });
      if (campaign.created_by_id && campaign.created_by_id !== user.id) {
        await base44.entities.Notification.create({
          recipient_id: campaign.created_by_id,
          type: 'comment',
          message: `${name} commented on "${campaign.title}"`,
          link: `/campaign/${campaign.id}`,
          read: false,
        });
      }
      setNewComment('');
      await load();
    } catch (e) {
      toast({ title: 'Could not post comment', description: e.message, variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (c) => {
    if (!user) return;
    const liked = (c.liked_by || []).includes(user.id);
    const likedBy = liked ? (c.liked_by || []).filter((id) => id !== user.id) : [...(c.liked_by || []), user.id];
    try {
      await base44.entities.Comment.update(c.id, { likes: liked ? (c.likes || 0) - 1 : (c.likes || 0) + 1, liked_by: likedBy });
      await load();
    } catch (e) {}
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-400" /> Updates</h2>
        {isCreator && (
          <div className="mb-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <Textarea value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)} placeholder="Share an update with your supporters…" rows={3} className="bg-white/[0.03] border-white/10 rounded-xl resize-none mb-3" />
            <Button onClick={postUpdate} disabled={posting || !newUpdate.trim()} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] gap-2 rounded-xl"><Send className="w-4 h-4" /> Post Update</Button>
          </div>
        )}
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-white/[0.02] animate-pulse" />)}</div>
        ) : updates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-stone-500">No updates yet.</div>
        ) : (
          <div className="space-y-3">
            {sortedUpdates.map((u) => (
              <div key={u.id} className={cn('rounded-2xl border p-4', u.pinned ? 'border-emerald-400/30 bg-emerald-400/[0.03]' : 'border-white/5 bg-white/[0.02]')}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {u.pinned && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-400 text-[#0B0F0E] font-semibold flex items-center gap-1"><Pin className="w-2.5 h-2.5" /> Pinned</span>}
                    <span className="text-xs text-stone-500">{u.author_name} · {new Date(u.created_date).toLocaleString()}</span>
                  </div>
                  {isCreator && (
                    <div className="flex gap-1">
                      <button onClick={() => togglePin(u)} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-stone-400"><Pin className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteUpdate(u)} className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-stone-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-stone-300 whitespace-pre-wrap leading-relaxed">{u.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Comments</h2>
        {user ? (
          <div className="mb-4 flex gap-2">
            <Textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Leave a comment…" rows={2} className="bg-white/[0.03] border-white/10 rounded-xl resize-none" />
            <Button onClick={postComment} disabled={posting || !newComment.trim()} className="self-end bg-gradient-to-r from-emerald-400 to-teal-500 text-[#0B0F0E] rounded-xl"><Send className="w-4 h-4" /></Button>
          </div>
        ) : (
          <p className="text-xs text-stone-500 mb-4">Log in to comment.</p>
        )}
        {comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-stone-500">No comments yet.</div>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => {
              const liked = user && (c.liked_by || []).includes(user.id);
              return (
                <div key={c.id} className="flex items-start gap-3 rounded-xl bg-white/[0.02] p-4 border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[#0B0F0E] font-semibold text-xs shrink-0">{c.author_name?.[0]?.toUpperCase() || '?'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium">{c.author_name || 'Supporter'}</p>
                      <span className="text-[10px] text-stone-500">{new Date(c.created_date).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-stone-300 whitespace-pre-wrap">{c.content}</p>
                    <button onClick={() => toggleLike(c)} className={cn('mt-1.5 inline-flex items-center gap-1 text-xs', liked ? 'text-rose-400' : 'text-stone-500 hover:text-stone-300')}><Heart className={cn('w-3 h-3', liked && 'fill-current')} /> {c.likes || 0}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}