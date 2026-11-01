import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const id = String(body?.post_id || '').trim();
    const action = String(body?.action || '').trim();
    if (!id || !['edit','schedule','delete'].includes(action)) return Response.json({ error: 'Invalid request' }, { status: 400 });
    const rows = await base44.asServiceRole.entities.DistributedPost.filter({ id });
    const post = rows?.[0];
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
    if (post.created_by_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Not authorized' }, { status: 403 });
    if (post.status === 'published') return Response.json({ error: 'Published posts cannot be changed here' }, { status: 409 });

    if (action === 'delete') {
      await base44.asServiceRole.entities.DistributedPost.delete(id);
      return Response.json({ ok: true, deleted: true, post_id: id });
    }
    if (action === 'edit') {
      const content = String(body?.content || '').trim();
      if (!content || content.length > 10000) return Response.json({ error: 'Post content is invalid' }, { status: 400 });
      await base44.asServiceRole.entities.DistributedPost.update(id, { content });
      return Response.json({ ok: true, post: { ...post, content } });
    }
    const when = new Date(String(body?.scheduled_for || ''));
    if (!Number.isFinite(when.getTime()) || when.getTime() <= Date.now()) return Response.json({ error: 'Schedule time must be in the future' }, { status: 400 });
    const patch = { status: 'scheduled', scheduled_for: when.toISOString() };
    await base44.asServiceRole.entities.DistributedPost.update(id, patch);
    return Response.json({ ok: true, post: { ...post, ...patch } });
  } catch (error) {
    console.error('manageDistributedPost failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Post could not be changed safely.' }, { status: 500 });
  }
}
