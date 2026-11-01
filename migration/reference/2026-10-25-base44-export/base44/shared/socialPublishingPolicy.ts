import { hasSubscriptionLevel } from './subscriptionEntitlements.ts';

// Paid member campaign distribution: one confirmed agent publication on each
// outside platform in ANY rolling twelve hours. The cap is platform-global
// across members, never per user. Official IFund-owned media is separate.
export const MEMBER_POST_WINDOW_MS = 12 * 60 * 60 * 1000;
export const MEMBER_QUEUE_MAX_PER_RUN = 1;

export function paidPriorityAt(owner: any): string {
  // Only provider-verified first paid subscriptions receive an early rank.
  // Unknown paid start is NOT a signup date: older account creation is
  // not evidence of earlier paid subscription. Place unknowns after verified
  // subscription starts, then use actual queue creation as tie breaker.
  const verified = Date.parse(String(owner?.first_paid_subscription_at || ''));
  return Number.isFinite(verified)
    ? new Date(verified).toISOString() : '9999-12-31T23:59:59.000Z';
}

export function canEnterMemberQueue(owner: any, campaign: any): boolean {
  return !!owner && !owner.account_deletion_pending &&
    (!owner.account_status || owner.account_status === 'active') &&
    hasSubscriptionLevel(owner, 2) && !!campaign &&
    campaign.status === 'active' && campaign.outreach_enabled === true &&
    campaign.outreach_paused !== true;
}

export function lastPlatformPublication(posts: any[], platform: string, nowMs: number) {
  const recent = (posts || []).filter((p) => p.platform === platform &&
    (p.origin === 'agent_autopilot' || !p.origin) &&
    p.status === 'published')
    .map((p) => Date.parse(String(p.published_at || '')))
    .filter((t) => Number.isFinite(t) && t <= nowMs);
  return recent.length ? Math.max(...recent) : 0;
}

export function platformMayPublish(posts: any[], platform: string, nowMs: number) {
  const last = lastPlatformPublication(posts, platform, nowMs);
  return !last || nowMs - last >= MEMBER_POST_WINDOW_MS;
}

// Strict FIFO within a fairness cycle: the earliest subscribed member gets
// first service. Once served, the next oldest member gets the next slot.
// That keeps older subscribers first WITHOUT starving everyone else.
export function chooseNextMember(
  permits: any[], published: any[], nowMs: number,
): any | null {
  const lastByOwner = new Map<string, number>();
  for (const row of published || []) {
    const at = Date.parse(String(row.published_at || ''));
    if (!Number.isFinite(at) || at > nowMs) continue;
    const prior = lastByOwner.get(row.owner_user_id) || 0;
    if (at > prior) lastByOwner.set(row.owner_user_id, at);
  }
  return [...(permits || [])].sort((a: any, b: any) => {
    // First give every eligible subscriber one turn in first-paid order,
    // then resume oldest last-served, with subscription order as tie-break.
    const servedA = lastByOwner.get(a.owner_user_id) || 0;
    const servedB = lastByOwner.get(b.owner_user_id) || 0;
    if (servedA !== servedB) return servedA - servedB;
    const priority = String(a.priority_at || '9999').localeCompare(String(b.priority_at || '9999'));
    if (priority) return priority;
    const created = String(a.created_date || '').localeCompare(String(b.created_date || ''));
    return created || String(a.id).localeCompare(String(b.id));
  })[0] || null;
}

export function isExplicitOfficialExemption(account: any, connection: any) {
  return !!account && account.status === 'active' &&
    ['ifund_facebook_group','ifund_instagram','ifund_facebook_business'].includes(account.account_type) &&
    account.connection_id === connection?.id && !!connection?.id &&
    connection.status === 'connected' &&
    connection.verification_status === 'verified';
}
