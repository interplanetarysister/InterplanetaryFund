import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { IFUND_PHOTO_EDIT_STYLE } from '../../shared/ifundSignatureStyle.ts';

const APP_ID = '6a67a778342a8fe05ee79cba';

// Base44 returns both media CDN URLs and public, app-scoped upload URLs.
// Accept only files hosted by THIS IFund app; never fetch arbitrary third-party URLs.
function validatedImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    const onCdn = url.hostname === 'media.base44.com' &&
      url.pathname.startsWith(`/images/public/${APP_ID}/`);
    const onAppHost = url.hostname === 'base44.app' &&
      url.pathname.startsWith(`/api/apps/${APP_ID}/files/mp/public/`);
    return onCdn || onAppHost ? url.href : '';
  } catch { return ''; }
}

// Image-to-image uses a real image input. The text-only Base44 GenerateImage
// API MUST NEVER be used to pretend a photograph has been edited.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sign in to restyle a photo.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const sourceUrl = validatedImageUrl(body.source_url);
    if (!sourceUrl) return Response.json({ error: 'Upload a photo to IFund first.' }, { status: 400 });

    // With no securely configured edit-capable provider, explicitly request
    // the faithful local treatment. No fabricated AI edit results or charges.
    const key = String(secrets.get('OPENAI_API_KEY') || '').trim();
    if (!key) return Response.json({
      ok: true, mode: 'photo_treatment', source_url: sourceUrl,
      message: 'Original-photo IFund styling is available without AI credits.',
    });

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-2',
        images: [{ image_url: sourceUrl }],
        prompt: IFUND_PHOTO_EDIT_STYLE,
        quality: 'medium',
        size: 'auto',
      }),
      signal: AbortSignal.timeout(75000),
    });

    if (!response.ok) {
      console.warn('Image edit provider unavailable', response.status);
      return Response.json({ ok: true, mode: 'photo_treatment', source_url: sourceUrl });
    }
    const result = await response.json();
    const b64 = result?.data?.[0]?.b64_json || result?.image?.b64_json || '';
    if (typeof b64 !== 'string' || !/^[a-zA-Z0-9+/=]+$/.test(b64)) {
      return Response.json({ ok: true, mode: 'photo_treatment', source_url: sourceUrl });
    }

    // Avoid streaming an oversized encoded image through an invocation result.
    // Save original-size edits on Base44's managed storage if possible.
    try {
      const fileBytes = Uint8Array.from(atob(b64), byte => byte.charCodeAt(0));
      const file = new File([fileBytes], `ifund-photo-edit-${Date.now()}.png`, { type: 'image/png' });
      const saved = await base44.integrations.Core.UploadFile({ file });
      const url = validatedImageUrl(saved?.file_url);
      if (url) return Response.json({
        ok: true, mode: 'ai_photo_edit', url, source_url: sourceUrl,
        style: 'interplanetary_fund',
      });
    } catch {
      // The UI still provides a real, faithful treatment of the original.
    }

    return Response.json({ ok: true, mode: 'photo_treatment', source_url: sourceUrl });
  } catch (error) {
    console.error('renderInterplanetaryPhoto failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({
      ok: false, error: 'AI photo editing is unavailable; keep your original or apply the local IFund treatment.',
      code: 'image_edit_unavailable',
    }, { status: 503 });
  }
}
