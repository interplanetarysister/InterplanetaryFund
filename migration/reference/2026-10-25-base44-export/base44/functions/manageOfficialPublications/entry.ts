import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const KINDS = new Set(['report', 'status_report', 'presentation', 'research', 'announcement']);
const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const safe = (entry: any) => ({
  id: entry.id,
  kind: entry.kind,
  title: entry.title,
  summary: entry.summary,
  body: entry.body || '',
  pdf_url: entry.pdf_url || '',
  file_label: entry.file_label || '',
  published_at: entry.published_at,
});
const deny = (error: string, status: number) => Response.json({ ok: false, error }, { status });

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const mode = clean(body.mode || 'feed', 24);

    if (mode === 'feed') {
      const results = await sr.entities.OfficialPublication.filter({ status: 'published' }, '-published_at', 120);
      return Response.json({ ok: true, items: (results || []).filter((entry: any) =>
        entry.status === 'published' && entry.final_approved === true).map(safe) });
    }

    if (mode === 'item') {
      const id = clean(body.id, 72);
      if (!id) return deny('Publication not found.', 404);
      const entry = await sr.entities.OfficialPublication.get(id).catch(() => null);
      if (!entry || entry.status !== 'published' || entry.final_approved !== true) return deny('Publication not found.', 404);
      return Response.json({ ok: true, item: safe(entry) });
    }

    // No public draft-saving endpoint: only a real administrator can release a finalized item.
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') return deny('Administrator access required.', 403);

    if (mode === 'publish') {
      if (body.final_approved !== true || body.public_visibility_confirmed !== true)
        return deny('Confirm that this is the final, public-safe version before publishing.', 400);

      const kind = clean(body.kind, 32);
      const title = clean(body.title, 140);
      const summary = clean(body.summary, 500);
      const article = clean(body.body, 24000);
      const pdf = clean(body.pdf_url, 2000);
      const label = clean(body.file_label, 140);
      if (!KINDS.has(kind) || title.length < 5 || summary.length < 20)
        return deny('Choose a category, a title and a descriptive summary.', 400);
      if (article.length < 30 && !pdf)
        return deny('Provide the final article or an approved PDF presentation.', 400);
      if (pdf) {
        try {
          const u = new URL(pdf);
          if (u.protocol !== 'https:' || u.username || u.password) throw new Error('bad url');
        } catch { return deny('The PDF must have a secure HTTPS file URL.', 400); }
      }
      const now = new Date().toISOString();
      const entry = await sr.entities.OfficialPublication.create({
        kind, title, summary, body: article, pdf_url: pdf, file_label: label,
        status: 'published', final_approved: true, published_at: now, updated_at: now,
      });
      return Response.json({ ok: true, item: safe(entry) });
    }

    if (mode === 'retract') {
      const id = clean(body.id, 72);
      const entry = id ? await sr.entities.OfficialPublication.get(id).catch(() => null) : null;
      if (!entry) return deny('Publication not found.', 404);
      await sr.entities.OfficialPublication.update(entry.id, { status: 'unpublished', updated_at: new Date().toISOString() });
      return Response.json({ ok: true, retracted: true });
    }

    return deny('Unsupported publication action.', 400);
  } catch (error) {
    console.error('manageOfficialPublications failed:', error instanceof Error ? error.name : 'UnknownError');
    return deny('Publications are temporarily unavailable.', 500);
  }
}
