import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function b64urlBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
}
function b64urlJson(value: string) {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(value)));
}
async function importPublicKey(pem: string) {
  const body = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
  if (!body) throw new Error('missing webhook public key');
  return crypto.subtle.importKey('spki', Uint8Array.from(atob(body), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}
async function verifyWixJwt(token: string, pem: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid webhook token');
  const header = b64urlJson(parts[0]);
  if (header?.alg !== 'RS256') throw new Error('unexpected webhook algorithm');
  const key = await importPublicKey(pem);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) throw new Error('invalid webhook signature');
  const payload = b64urlJson(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (payload?.exp && Number(payload.exp) < now) throw new Error('expired webhook token');
  if (payload?.iat && Number(payload.iat) > now + 300) throw new Error('future webhook token');
  return payload;
}
function parseEventData(value: unknown) {
  if (typeof value !== 'string') return value && typeof value === 'object' ? value : {};
  try { return JSON.parse(value); } catch { return {}; }
}

export default async function(req: Request) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const publicKey = Deno.env.get('WIX_WEBHOOK_PUBLIC_KEY') || '';
    if (!publicKey) return Response.json({ error: 'Webhook verification is not configured.' }, { status: 503 });
    const raw = await req.text();
    let outer: any;
    try { outer = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid webhook payload.' }, { status: 400 }); }
    const token = typeof outer?.data === 'string' ? outer.data : '';
    if (!token) return Response.json({ error: 'Signed webhook data is required.' }, { status: 401 });
    let envelope: any;
    try { envelope = await verifyWixJwt(token, publicKey); }
    catch { return Response.json({ error: 'Webhook verification failed.' }, { status: 401 }); }

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const eventType = String(envelope?.eventType || envelope?.event_type || 'unknown');
    const instanceId = String(envelope?.instanceId || envelope?.instance_id || '');
    const data: any = parseEventData(envelope?.data);
    const eventId = String(envelope?.eventId || envelope?.event_id || data?.id || data?._id || '');
    const stableId = eventId || await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then(b => Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''));
    const externalId = `wix:${instanceId}:${eventType}:${stableId}`;
    const existing = await sr.entities.ExternalSyncEvent.filter({ provider: 'wix', event_id: externalId });
    if (existing?.length) return Response.json({ ok: true, duplicate: true });
    let record = await sr.entities.ExternalSyncEvent.create({ provider: 'wix', event_id: externalId, event_type: eventType, instance_id: instanceId, entity_id: String(data?.id || data?._id || ''), status: 'received', received_at: new Date().toISOString(), payload: { instanceId, eventType, data } });
    // Converge: concurrent deliveries may pass the duplicate check and each
    // create a row. Keep the earliest, delete the rest — this is a diagnostic
    // sync-signal entity, never a financial record, but convergence prevents
    // unbounded duplicate accumulation.
    const converged = await sr.entities.ExternalSyncEvent.filter({ provider: 'wix', event_id: externalId }, 'created_date', 10).catch(() => []);
    if (converged.length > 1) {
      const ordered = [...converged].sort((a, b) => {
        const at = new Date(a.created_date || 0).getTime();
        const bt = new Date(b.created_date || 0).getTime();
        if (at !== bt) return at - bt;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      record = ordered[0];
      for (const dup of ordered.slice(1)) await sr.entities.ExternalSyncEvent.delete(dup.id).catch(() => {});
    }
    // Webhooks are synchronization signals only. Financial events never create
    // IFund Donation records or withdrawable balances without settlement reconciliation.
    await sr.entities.ExternalSyncEvent.update(record.id, { status: 'processed', processed_at: new Date().toISOString() });
    return Response.json({ ok: true, duplicate: false });
  } catch (error) {
    console.error('wixWebhook error:', error?.message || error);
    return Response.json({ error: 'Webhook could not be processed.' }, { status: 500 });
  }
}