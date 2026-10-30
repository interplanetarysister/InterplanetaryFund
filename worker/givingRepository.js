const PAYMENT_METHODS = new Set([
  'paypal', 'googlepay', 'applepay', 'cashapp', 'stripe', 'stripe_crypto', 'other',
]);
const RECURRING_STATUSES = new Set(['active', 'paused', 'cancelled']);

function money(value, { nullable = false, positive = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    throw new Error('giving amount missing');
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1000000000000) {
    throw new Error('giving amount invalid');
  }
  const cents = Math.round(numeric * 100);
  if (Math.abs(numeric * 100 - cents) > 0.0001) throw new Error('giving amount precision invalid');
  const normalized = cents / 100;
  if (positive && normalized <= 0) throw new Error('giving amount must be positive');
  return normalized;
}

function timestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('giving date invalid');
  return new Date(parsed).toISOString();
}

function normalizeDonation(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('giving row malformed');
  if (typeof row.id !== 'string' || row.id.length < 1 || row.id.length > 500) throw new Error('giving id invalid');
  if (typeof row.campaign_id !== 'string' || row.campaign_id.length < 1 || row.campaign_id.length > 500) throw new Error('giving campaign invalid');
  if (typeof row.campaign_title !== 'string' || row.campaign_title.length > 500) throw new Error('giving title invalid');
  if (typeof row.is_recurring !== 'boolean') throw new Error('giving recurrence invalid');

  const amount = money(row.amount, { positive: true });
  const platformSupportAmount = money(row.platform_support_amount ?? 0);
  const processingFee = money(row.processing_fee, { nullable: true });
  const totalCharged = money(row.total_charged, { nullable: true });
  if (processingFee !== null && totalCharged !== null) {
    const expected = Math.round((amount + platformSupportAmount + processingFee) * 100) / 100;
    if (Math.abs(totalCharged - expected) > 0.01) throw new Error('giving charge allocation invalid');
  }

  const recurringStatus = row.recurring_status == null || row.recurring_status === ''
    ? (row.is_recurring ? 'active' : null)
    : String(row.recurring_status);
  if (recurringStatus !== null && !RECURRING_STATUSES.has(recurringStatus)) throw new Error('giving recurrence status invalid');

  const paymentMethod = typeof row.payment_method === 'string' && PAYMENT_METHODS.has(row.payment_method)
    ? row.payment_method : 'other';
  const donorName = typeof row.donor_name === 'string' && row.donor_name.trim()
    ? row.donor_name.trim().slice(0, 200) : 'Anonymous';

  return {
    id: row.id,
    campaign_id: row.campaign_id,
    campaign_title: row.campaign_title || 'Campaign',
    amount,
    platform_support_amount: platformSupportAmount,
    processing_fee: processingFee,
    total_charged: totalCharged,
    donor_name: donorName,
    is_recurring: row.is_recurring,
    recurring_status: recurringStatus,
    payment_method: paymentMethod,
    created_date: timestamp(row.created_date),
  };
}

/**
 * Read verified gifts through a SECURITY DEFINER RPC whose identity is derived
 * from auth.uid(). The browser JWT is forwarded; no service-role credential is
 * available to or required by this repository.
 */
export async function listMyGiving(env, jwt, fetcher = fetch) {
  if (typeof jwt !== 'string' || !/^[A-Za-z0-9._~-]+$/.test(jwt)) throw new Error('giving identity missing');
  const result = await fetcher(env.SUPABASE_URL + '/rest/v1/rpc/ifund_my_giving', {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + jwt,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!result.ok) throw new Error('giving repository unavailable');
  const rows = await result.json();
  if (!Array.isArray(rows)) throw new Error('giving repository response malformed');
  const seen = new Set();
  return rows.map(row => {
    const donation = normalizeDonation(row);
    if (seen.has(donation.id)) throw new Error('duplicate giving row');
    seen.add(donation.id);
    return donation;
  });
}
