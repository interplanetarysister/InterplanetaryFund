import { reconcileCanonicalCampaignProjection } from './base44Financial.ts';

// Application-layer financial mirrors. Base44 FinancialOperation is the financial authority;
// Base44 rows exist so current UI surfaces keep working. Every financial or
// external-observation mirror is keyed by canonical_operation_id and converges
// to exactly one row, allowing replay to repair side effects after a crash.

function stableOrder(rows) {
  return [...(rows || [])].sort((a, b) => {
    const at = new Date(a.created_date || 0).getTime();
    const bt = new Date(b.created_date || 0).getTime();
    if (at !== bt) return at - bt;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

async function reconcileOne(entity, canonicalOperationId, data) {
  const key = String(canonicalOperationId || '');
  if (!key) throw new Error('Canonical operation id is required for a financial mirror.');

  let rows = await entity.filter({ canonical_operation_id: key }).catch(() => []);
  let primary = stableOrder(rows)[0] || null;
  if (!primary) primary = await entity.create({ ...data, canonical_operation_id: key });
  else await entity.update(primary.id, { ...data, canonical_operation_id: key });

  rows = await entity.filter({ canonical_operation_id: key }).catch(() => []);
  const ordered = stableOrder(rows);
  const keep = ordered[0] || primary;
  for (const duplicate of ordered.slice(1)) {
    await entity.delete(duplicate.id).catch(() => {});
  }
  return keep;
}

export async function reconcileDonationMirror(sr, canonicalOperationId, data) {
  const mirror = await reconcileOne(sr.entities.Donation, canonicalOperationId, data);

  // Campaign totals are derived from verified Donation mirrors. Recompute only
  // AFTER the donation row has converged; doing this before mirror creation
  // writes the previous total back to Campaign and leaves successful provider
  // payments invisible until some unrelated later repair.
  const campaignId = String(data?.campaign_id || mirror?.campaign_id || '').trim();
  if (campaignId) {
    await reconcileCanonicalCampaignProjection(sr, campaignId);
  }

  return mirror;
}

export async function reconcileNotificationMirror(sr, canonicalOperationId, data) {
  return reconcileOne(sr.entities.Notification, canonicalOperationId, data);
}

export async function reconcileInboxMirror(sr, canonicalOperationId, data) {
  return reconcileOne(sr.entities.InboxItem, canonicalOperationId, data);
}
