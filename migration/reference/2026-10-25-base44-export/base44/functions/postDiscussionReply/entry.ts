import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Posts a reply to a discussion thread. Creates the reply as the user (so the
// author owns it under RLS) and increments the parent post's reply_count as the
// service role — DiscussionPost.update is author-only under RLS, so a replier
// could not update the counter directly.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { post_id, community_id, content } = await req.json();
    if (!post_id || !content || !content.trim()) {
      return Response.json({ error: 'Missing reply details' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const post = await sr.entities.DiscussionPost.get(post_id).catch(() => null);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    const reply = await base44.entities.DiscussionReply.create({
      post_id,
      community_id: community_id || post.community_id,
      content,
      author_name: user.full_name || user.email,
    });
    // Atomic increment — avoids the read-modify-write race on concurrent replies.
    await sr.entities.DiscussionPost.updateMany(
      { id: post_id },
      { $inc: { reply_count: 1 } }
    );
    return Response.json({ reply });
  } catch (error) {
    console.error('postDiscussionReply error:', error.message);
    return Response.json({ error: 'Unable to post your reply. Please try again.' }, { status: 500 });
  }
}