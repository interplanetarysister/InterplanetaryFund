import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureCanonicalCampaign, recordCanonicalExternalObservation } from '../../shared/base44Financial.ts';
import { reconcileInboxMirror, reconcileNotificationMirror } from '../../shared/financialMirrors.ts';

// Ko-fi webhooks report payments made directly into the creator's connected
// PayPal/Stripe account. They are canonical EXTERNAL OBSERVATIONS only — never
// IF-withdrawable funds until a separate, verified transfer into IF occurs.
// Ko-fi retries a failed delivery with the same message_id, which is the primary
// provider identity. A deterministic payload hash remains only as a legacy/test
// fallback when message_id is absent.

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function stableOrder(rows) {
  return [...(rows || [])].sort((a, b) => {
    const at = new Date(a.created_date || 0).getTime();
    const bt = new Date(b.created_date || 0).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

async function recoveryRecord(sr, eventKey, eventType) {
  let rows = await sr.entities.WebhookEvent.filter({ source: 'kofi', event_key: eventKey }).catch(() => []);
  let record = stableOrder(rows)[0] || null;
  if (!record) {
    record = await sr.entities.WebhookEvent.create({
      source: 'kofi',
      event_key: eventKey,
      event_type: eventType || 'payment',
      state: 'claimed',
      attempt_count: 1,
    });
  } else if (record.state !== 'side_effects_complete') {
    await sr.entities.WebhookEvent.update(record.id, {
      event_type: eventType || record.event_type || 'payment',
      attempt_count: Number(record.attempt_count || 0) + 1,
      last_error: '',
    });
  }

  // Base44 recovery rows are diagnostic only. FinancialOperation owns idempotency; collapse
  // any duplicate local rows deterministically so all retries use one state row.
  rows = await sr.entities.WebhookEvent.filter({ source: 'kofi', event_key: eventKey }).catch(() => []);
  const ordered = stableOrder(rows);
  record = ordered[0] || record;
  for (const duplicate of ordered.slice(1)) await sr.entities.WebhookEvent.delete(duplicate.id).catch(() => {});
  return record;
}

async function markRecovery(sr, record, patch) {
  if (!record?.id) return;
  await sr.entities.WebhookEvent.update(record.id, patch).catch(() => {});
}

function parsePayload(req, contentType) {
  if (contentType.includes('application/json')) {
    return req.json().then((body) => {
      if (typeof body?.data === 'string') return JSON.parse(body.data);
      return body?.data || body;
    });
  }
  return req.formData().then((form) => {
    const raw = form.get('data');
    if (!raw) throw new Error('Missing data field');
    return JSON.parse(String(raw));
  });
}

function fallbackProviderId(payload, connectionId) {
  const stableFields = [
    String(connectionId || ''),
    String(payload.type || ''),
    String(payload.amount || ''),
    String(payload.currency || ''),
    String(payload.from_name || ''),
    String(payload.email || ''),
    String(payload.message || ''),
    String(payload.url || ''),
    String(payload.timestamp || ''),
  ].join('|');
  return `legacy-${cyrb53(stableFields)}`;
}

export default async function(req) {
  let base44;
  let recovery = null;
  try {
    base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const contentType = req.headers.get('content-type') || '';
    const payload = await parsePayload(req, contentType);

    const token = payload?.verification_token;
    if (!token) return Response.json({ error: 'Missing verification token' }, { status: 401 });

    const connections = await sr.entities.PlatformConnection.filter({ platform: 'kofi' });
    const connection = connections.find((c) => c.credentials && c.credentials.kofi_verification_token === token);
    if (!connection) return Response.json({ error: 'Unknown verification token' }, { status: 401 });
    if (!connection.campaign_id) return Response.json({ error: 'Ko-fi connection is not linked to a campaign' }, { status: 409 });

    const campaign = await sr.entities.Campaign.get(connection.campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Linked campaign not found' }, { status: 409 });
    if (!campaign.created_by_id || campaign.created_by_id !== connection.created_by_id) {
      return Response.json({ error: 'Ko-fi connection ownership does not match the linked campaign' }, { status: 403 });
    }

    const amount = Number.parseFloat(payload.amount);
    const currency = String(payload.currency || '').trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'Invalid Ko-fi payment amount' }, { status: 400 });
    if (!/^[A-Z]{3}$/.test(currency)) return Response.json({ error: 'Invalid Ko-fi currency' }, { status: 400 });

    const providerId = String(payload.message_id || payload.kofi_transaction_id || fallbackProviderId(payload, connection.id));
    const operationKey = `kofi:${connection.id}:${providerId}`;
    const eventKey = `kofi:${providerId}`;
    recovery = await recoveryRecord(sr, eventKey, payload.type || 'payment');
    if (recovery?.state === 'side_effects_complete') return Response.json({ ok: true, duplicate: true });

    await ensureCanonicalCampaign(sr, campaign);
    const observation = await recordCanonicalExternalObservation(sr, {
      operationKey,
      provider: 'kofi',
      providerTransactionId: providerId,
      providerAccountId: String(connection.id),
      campaignId: campaign.id,
      campaignOwnerUserId: campaign.created_by_id,
      amount,
      currency,
      donorName: payload.from_name || 'Ko-fi supporter',
      ...(payload.email ? { donorEmail: String(payload.email) } : {}),
      source: 'kofi_webhook',
      metadata: JSON.stringify({ type: payload.type || 'payment', url: payload.url || '', isSubscription: !!payload.is_subscription_payment }),
    });

    await markRecovery(sr, recovery, {
      state: 'financial_applied',
      canonical_operation_id: String(observation.observationId),
      financial_applied_at: new Date().toISOString(),
      last_error: '',
    });

    const now = new Date().toISOString();
    const priorCurrency = String(connection.external_currency || '').trim().toUpperCase();
    if (priorCurrency && priorCurrency !== currency) {
      // Never combine currencies in one numeric total. The incoming canonical
      // observation remains independently auditable, while the connection's
      // retained total keeps its original source and observed-at timestamp.
      const mismatchDetail = `Ko-fi observation received in ${currency}; existing connection total is ${priorCurrency}. Currency conversion/reconciliation required.`;
      await sr.entities.PlatformConnection.update(connection.id, {
        status: 'error',
        verification_status: 'verified',
        last_synced: now,
        last_error: mismatchDetail,
        history: [
          ...(connection.history || []),
          { at: now, event: 'currency_mismatch', detail: mismatchDetail },
        ].slice(-30),
      });
    } else {
      await sr.entities.PlatformConnection.update(connection.id, {
        external_total: Number(observation.observedTotal || 0),
        external_donor_count: Number(observation.observedCount || 0),
        external_currency: currency,
        status: 'connected',
        verification_status: 'verified',
        external_data_source: 'provider_verified',
        external_balance_observed_at: now,
        last_synced: now,
        last_error: '',
        history: [
          ...(connection.history || []),
          { at: now, event: observation.created ? 'synced' : 'reconciled', detail: `Ko-fi ${payload.type || 'payment'}: ${currency} ${amount.toFixed(2)} from ${payload.from_name || 'a supporter'} (external observation only)` },
        ].slice(-30),
      });
    }

    await reconcileInboxMirror(sr, observation.observationId, {
      user_id: campaign.created_by_id,
      platform: 'kofi',
      campaign_id: campaign.id,
      campaign_title: campaign.title,
      type: 'donation',
      author: payload.from_name || 'Ko-fi supporter',
      content: `External Ko-fi payment observed: ${currency} ${amount.toFixed(2)}${payload.message ? ` — \"${String(payload.message).slice(0, 400)}\"` : ''}. This payment went to your connected Ko-fi payment account and is not an IF-withdrawable balance.`,
      link: payload.url || connection.external_url || '',
      status: 'open',
    });

    await reconcileNotificationMirror(sr, observation.observationId, {
      user_id: campaign.created_by_id,
      title: 'New Ko-fi payment observed',
      body: `${payload.from_name || 'A supporter'} paid ${currency} ${amount.toFixed(2)} on Ko-fi. It remains external until transferred into Interplanetary Fund.`,
      type: 'donation',
      link: '/inbox',
      read: false,
    });

    await markRecovery(sr, recovery, {
      state: 'side_effects_complete',
      canonical_operation_id: String(observation.observationId),
      side_effects_completed_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      last_error: '',
    });
    return Response.json({ ok: true, duplicate: !observation.created, external_only: true, currency, observed_total: observation.observedTotal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('kofiWebhook error:', message);
    if (base44 && recovery) {
      await markRecovery(base44.asServiceRole, recovery, { state: 'failed', last_error: message.slice(0, 500) });
    }
    // Ko-fi retries non-2xx deliveries with the same message_id, while Base44 FinancialOperation
    // idempotency guarantees any already-recorded observation is not duplicated.
    return Response.json({ error: 'Unable to process Ko-fi webhook' }, { status: 500 });
  }
}
