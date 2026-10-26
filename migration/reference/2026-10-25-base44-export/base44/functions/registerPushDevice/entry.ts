import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// Server-only token registry. These FCM addresses NEVER authenticate a user.
// All writes are bound to a freshly verified Base44 user, never client user_id.
export default async function registerPushDevice(req: Request) {
  try {
    if (req.method !== 'POST') return reply({ error: 'POST required.' }, 405);
    const client = createClientFromRequest(req);
    const verified = await assertActiveAccount(client);
    if (!verified.ok) return reply({ error: verified.error || 'Sign in required.' }, verified.status || 401);

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || '');
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!['register', 'revoke'].includes(mode) || token.length < 32 || token.length > 4096 ||
        !/^[A-Za-z0-9._:\-]+$/.test(token) || body.platform !== 'android') {
      return reply({ error: 'Invalid Android device registration request.' }, 400);
    }

    const entities = client.asServiceRole.entities;
    const rows = await entities.PushDevice.filter({ token }, '-created_date', 3);
    if ((rows || []).length > 1) return reply({ error: 'Device registration requires review.' }, 409);
    const matching = rows?.[0] || null;
    if (matching && matching.user_id !== verified.user.id) {
      return reply({ error: 'Device registration belongs to another account. Sign out on that device first.' }, 409);
    }

    if (mode === 'revoke') {
      if (matching) await entities.PushDevice.update(matching.id, {
        enabled: false, updated_at: new Date().toISOString(),
      });
      return reply({ ok: true, enabled: false });
    }

    const now = new Date().toISOString();
    if (matching) {
      await entities.PushDevice.update(matching.id, { enabled: true, updated_at: now });
    } else {
      // Limit orphan registrations. Deliberately refuse new ones once the cap is reached.
      const owned = await entities.PushDevice.filter({ user_id: verified.user.id }, '-created_date', 20);
      if ((owned || []).filter((row: { enabled?: boolean }) => row.enabled).length >= 6) {
        return reply({ error: 'Too many active devices. Disable notifications on an older device.' }, 429);
      }
      await entities.PushDevice.create({
        user_id: verified.user.id, token, platform: 'android',
        enabled: true, created_at: now, updated_at: now,
      });
    }
    return reply({ ok: true, enabled: true });
  } catch (err) {
    console.error('registerPushDevice failed:', err instanceof Error ? err.name : 'UnknownError');
    return reply({ error: 'Device registration is unavailable. Try again.' }, 503);
  }
}
