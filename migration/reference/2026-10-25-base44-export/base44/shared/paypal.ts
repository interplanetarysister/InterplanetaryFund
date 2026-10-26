import { secrets } from "base44:runtime";

export const IFUND_PAYPAL_ACCOUNT_REF = "interplanetary_business_paypal";
export const IFUND_PAYPAL_ACCOUNT_TYPE = "business";
export const IFUND_PAYPAL_BUSINESS_EMAIL = "cuddlemeplatonically@gmail.com";

// Shared PayPal helpers. All platform money moves use deterministic provider
// request identities so retries cannot create a second capture or payout.

function apiBase() {
  return secrets.get("PAYPAL_MODE") === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// Read-only API credential probe. A populated client ID is not proof that
// PayPal will authenticate the connected live merchant. Cache briefly to avoid
// repeated OAuth traffic when multiple checkout components mount together.
let restAccessProbe: { key: string; until: number; ok: boolean; pending: Promise<boolean> | null } = { key: '', until: 0, ok: false, pending: null };
export async function isLivePayPalRestReady() {
  const id = String(secrets.get('PAYPAL_CLIENT_ID') || '').trim();
  const secret = String(secrets.get('PAYPAL_CLIENT_SECRET') || '').trim();
  const mode = secrets.get('PAYPAL_MODE');
  if (mode !== 'live' || !id || !secret) return false;
  const key = `${mode}:${id}`;
  if (restAccessProbe.key === key && restAccessProbe.until > Date.now()) return restAccessProbe.ok;
  if (restAccessProbe.key === key && restAccessProbe.pending) return restAccessProbe.pending;
  const pending = getAccessToken()
    .then((token) => Boolean(token))
    .catch(() => false)
    .then((ok) => {
      restAccessProbe = { key, ok, until: Date.now() + (ok ? 90000 : 20000), pending: null };
      return ok;
    });
  restAccessProbe = { key, ok: false, until: 0, pending };
  return await pending;
}

let payoutAccessProbe: { until: number; ok: boolean; pending: Promise<boolean> | null } = { until: 0, ok: false, pending: null };
export async function isLivePayPalPayoutReady() {
  if (secrets.get('PAYPAL_MODE') !== 'live') return false;
  if (payoutAccessProbe.until > Date.now()) return payoutAccessProbe.ok;
  if (payoutAccessProbe.pending) return payoutAccessProbe.pending;
  const pending = getAccessToken()
    .then(async (token) => {
      const res = await fetch(`${apiBase()}/v1/payments/payouts/IFUND_READINESS_PROBE_DO_NOT_CREATE`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return ![401, 403].includes(res.status) && res.status < 500;
    })
    .catch(() => false)
    .then((ok) => {
      payoutAccessProbe = { ok, until: Date.now() + (ok ? 90000 : 20000), pending: null };
      return ok;
    });
  payoutAccessProbe = { ok: false, until: 0, pending };
  return await pending;
}

async function getAccessToken() {
  const id = secrets.get("PAYPAL_CLIENT_ID");
  const secret = secrets.get("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials are not configured.");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${id}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

function stableProviderKey(prefix, value, max = 80) {
  return `${prefix}_${String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, max)}`;
}

export async function sendPayout({ receiver, amount, note, itemId }) {
  const token = await getAccessToken();
  const senderBatchId = stableProviderKey('IFW', itemId, 70);
  let res;
  try {
    res = await fetch(`${apiBase()}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Defense-in-depth alongside sender_batch_id. The same Base44
        // withdrawal always sends exactly the same provider request identity.
        "PayPal-Request-Id": senderBatchId,
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: "You received a payout from Interplanetary Fund",
          email_message: "Your campaign withdrawal has been processed.",
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: { value: Number(amount).toFixed(2), currency: "USD" },
            receiver,
            note,
            sender_item_id: stableProviderKey('ITEM', itemId, 70),
          },
        ],
      }),
    });
  } catch (cause) {
    // A transport failure is ambiguous: PayPal may have accepted the payout
    // before the connection dropped. Callers MUST keep the canonical reservation
    // and must not release/re-send funds under a new withdrawal id.
    const err = new Error("PayPal payout status is unknown after a transport failure.");
    err.ambiguous = true;
    err.sender_batch_id = senderBatchId;
    err.cause = cause;
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = JSON.stringify(data || {}).toLowerCase();
    const duplicateOrAlreadySubmitted = raw.includes('sender_batch_id') && (raw.includes('already') || raw.includes('duplicate'));
    const err = new Error(data?.message || data?.error_description || `PayPal payout failed (${res.status})`);
    err.ambiguous = duplicateOrAlreadySubmitted;
    err.sender_batch_id = senderBatchId;
    err.http_status = res.status;
    throw err;
  }

  const batchId = data.batch_header?.payout_batch_id;
  const item = data.items?.[0];
  return {
    payout_batch_id: batchId,
    sender_batch_id: senderBatchId,
    transaction_status: item?.transaction_status || "PENDING",
  };
}

// Google Pay donations flow through the same PayPal business account as a
// standard PayPal v2 order: create an order on approval, capture it once the
// Google Pay payment data is confirmed.
export async function createOrder({ amount, description, customId, requestId }) {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(requestId ? { "PayPal-Request-Id": stableProviderKey("IF_ORDER", requestId, 70) } : {}),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: Number(amount).toFixed(2) },
          // Explicitly bind new orders to the designated IFund business
          // recipient. PayPal must reject mismatched/unauthorized credentials
          // rather than silently route donations to another merchant.
          payee: { email_address: IFUND_PAYPAL_BUSINESS_EMAIL },
          description: (description || "Donation").slice(0, 120),
          ...(customId ? { custom_id: customId } : {}),
        },
      ],
      application_context: { shipping_preference: "NO_SHIPPING" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `PayPal order create failed (${res.status})`);
  return { id: data.id };
}

function normalizeOrderResult(data) {
  const unit = data?.purchase_units?.[0] || {};
  const captures = Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [];
  const capture = captures.find((row) => String(row?.status || '').toUpperCase() === 'COMPLETED') || captures[0] || null;
  const given = data?.payer?.name?.given_name || data?.payment_source?.paypal?.name?.given_name;
  const sur = data?.payer?.name?.surname || data?.payment_source?.paypal?.name?.surname;
  const parsedAmount = Number.parseFloat(capture?.amount?.value || '0');
  // PayPal returns actual merchant receivable and fees on completed captures.
  // Estimates encoded at checkout are for preview, not final payout accounting.
  const breakdown = capture?.seller_receivable_breakdown || {};
  const captureCurrency = String(capture?.amount?.currency_code || '').toUpperCase();
  const parseCaptureMoney = (row) => {
    if (!row || String(row.currency_code || '').toUpperCase() !== captureCurrency) return null;
    const value = Number(row.value);
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
  };
  const providerFee = parseCaptureMoney(breakdown.paypal_fee);
  const providerNet = parseCaptureMoney(breakdown.net_amount);
  return {
    status: String(data?.status || ''),
    capture_status: String(capture?.status || ''),
    amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    payer_name: given ? `${given} ${sur || ''}`.trim() : '',
    payer_email: String(data?.payer?.email_address || data?.payment_source?.paypal?.email_address || ''),
    custom_id: String(unit?.custom_id || ''),
    capture_id: String(capture?.id || ''),
    currency: String(capture?.amount?.currency_code || unit?.amount?.currency_code || '').toUpperCase(),
    provider_processing_fee: providerFee,
    provider_receivable_amount: providerNet,
  };
}

export async function getOrder(orderId) {
  const id = String(orderId || '').trim();
  if (!id) throw new Error('PayPal order id is required.');
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v2/checkout/orders/${encodeURIComponent(id)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PayPal order lookup failed (${res.status})`);
  return normalizeOrderResult(data);
}

export async function captureOrder(orderId) {
  const token = await getAccessToken();
  const stableRequestId = stableProviderKey('IF_CAPTURE', orderId, 70);
  let res;
  let data = {};
  let captureFailure = null;
  try {
    res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": stableRequestId,
      },
    });
    data = await res.json().catch(() => ({}));
    if (res.ok) return normalizeOrderResult(data);
    captureFailure = new Error(data?.message || `PayPal capture failed (${res.status})`);
  } catch (cause) {
    captureFailure = new Error('PayPal capture response was not received.');
    captureFailure.cause = cause;
  }

  // Capture is an irreversible provider action. If the response was lost, or a
  // retry reaches PayPal after the order was already captured, recover the
  // provider-authoritative order state instead of leaving real money outside
  // IFund's ledger. A GET is read-only and succeeds only when PayPal itself
  // reports a completed order with a completed capture.
  try {
    const recovered = await getOrder(orderId);
    if (
      recovered.status === 'COMPLETED' &&
      recovered.capture_status === 'COMPLETED' &&
      recovered.capture_id &&
      recovered.amount > 0
    ) {
      return { ...recovered, recovered_after_capture_error: true };
    }
  } catch (_) {
    // Preserve the original capture failure. A failed recovery lookup must not
    // turn an unknown or declined payment into a successful donation.
  }

  throw captureFailure || new Error('PayPal capture failed.');
}


// Verify a transaction against the designated business PayPal account before
// exterior funds are admitted to the custody ledger. This is intentionally a
// read-only provider check; it does not create financial value by itself.
export async function verifyWebhookSignature(rawEvent, headers, verifiedBillingWebhookId = '') {
  const webhookId = String(verifiedBillingWebhookId || secrets.get('PAYPAL_WEBHOOK_ID') || '').trim();
  if (!webhookId) throw new Error('PayPal webhook id is not configured.');
  const transmissionId = String(headers?.get?.('paypal-transmission-id') || '').trim();
  const transmissionTime = String(headers?.get?.('paypal-transmission-time') || '').trim();
  const certUrl = String(headers?.get?.('paypal-cert-url') || '').trim();
  const authAlgo = String(headers?.get?.('paypal-auth-algo') || '').trim();
  const transmissionSig = String(headers?.get?.('paypal-transmission-sig') || '').trim();
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false;

  // Preserve the webhook event object byte-for-byte inside PayPal's verification
  // envelope. Their verification contract warns against parsing and re-stringifying
  // webhook_event before verification.
  const raw = String(rawEvent || '').trim();
  if (!raw || !raw.startsWith('{') || !raw.endsWith('}')) return false;
  const token = await getAccessToken();
  const body = [
    '{',
    `"transmission_id":${JSON.stringify(transmissionId)},`,
    `"transmission_time":${JSON.stringify(transmissionTime)},`,
    `"cert_url":${JSON.stringify(certUrl)},`,
    `"auth_algo":${JSON.stringify(authAlgo)},`,
    `"transmission_sig":${JSON.stringify(transmissionSig)},`,
    `"webhook_id":${JSON.stringify(webhookId)},`,
    `"webhook_event":${raw}`,
    '}',
  ].join('');
  const res = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PayPal webhook verification failed (${res.status})`);
  return String(data?.verification_status || '').toUpperCase() === 'SUCCESS';
}


export async function getTransaction(transactionId) {
  const id = String(transactionId || '').trim();
  if (!id) throw new Error('PayPal transaction id is required.');
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}/v1/reporting/transactions?transaction_id=${encodeURIComponent(id)}&fields=all&page_size=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `PayPal transaction lookup failed (${res.status})`);
  const details = Array.isArray(data?.transaction_details) ? data.transaction_details : [];
  const row = details.find((x) => String(x?.transaction_info?.transaction_id || '') === id);
  if (!row) return null;
  const info = row.transaction_info || {};
  const amount = info.transaction_amount || {};
  const fee = info.fee_amount || {};
  const parsedAmount = Number.parseFloat(amount.value || '0');
  const parsedFee = Math.abs(Number.parseFloat(fee.value || '0'));
  return {
    id: String(info.transaction_id || ''),
    status: String(info.transaction_status || ''),
    amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    currency: String(amount.currency_code || '').toUpperCase(),
    feeAmount: Number.isFinite(parsedFee) ? parsedFee : 0,
    feeCurrency: String(fee.currency_code || amount.currency_code || '').toUpperCase(),
    paypalAccountId: String(info.paypal_account_id || ''),
    transactionEventCode: String(info.transaction_event_code || ''),
    paypalReferenceId: String(info.paypal_reference_id || ''),
    paypalReferenceIdType: String(info.paypal_reference_id_type || ''),
    transactionSubject: String(info.transaction_subject || ''),
    transactionNote: String(info.transaction_note || ''),
    transactionInitiationDate: info.transaction_initiation_date || '',
    transactionUpdatedDate: info.transaction_updated_date || '',
  };
}


// Lists recent transactions visible to the designated business PayPal account.
// Used only for custody discovery; callers must still reconcile each candidate
// against an exterior observation before creating held value.
// PayPal Reporting API date windows are limited. Read *all* pages of each
// bounded interval, rather than silently treating page one as the ledger.
// This function is read-only. It never captures, refunds or sends money.
export async function listTransactions({ startDate, endDate, pageSize = 100 } = {}) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 24 * 60 * 60 * 1000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end ||
      end.getTime() - start.getTime() > 90 * 24 * 60 * 60 * 1000) {
    throw new Error('PayPal transaction search must cover a valid interval of at most 90 days.');
  }

  const token = await getAccessToken();
  const size = Math.max(1, Math.min(500, Number(pageSize) || 100));
  const maxWindowMs = 30 * 24 * 60 * 60 * 1000;
  const maxPagesPerWindow = 25;
  const resultsById = new Map();
  const endpoint = `${apiBase()}/v1/reporting/transactions`;

  for (let from = start.getTime(); from < end.getTime();) {
    const until = Math.min(from + maxWindowMs, end.getTime());
    const params = new URLSearchParams({
      start_date: new Date(from).toISOString(),
      end_date: new Date(until).toISOString(),
      fields: 'all',
      page_size: String(size),
    });
    let complete = false;
    for (let page = 1; page <= maxPagesPerWindow; page++) {
      params.set('page', String(page));
      const res = await fetch(`${endpoint}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`PayPal transaction search failed (${res.status}).`);
      if (!Array.isArray(data?.transaction_details)) {
        throw new Error('PayPal transaction search returned an invalid page.');
      }
      for (const row of data.transaction_details) {
        const info = row?.transaction_info || {};
        const id = String(info.transaction_id || '');
        if (!id) continue;
        const amount = info.transaction_amount || {};
        const fee = info.fee_amount || {};
        const parsedAmount = Number.parseFloat(amount.value || '0');
        const parsedFee = Math.abs(Number.parseFloat(fee.value || '0'));
        const entry = {
          id,
          status: String(info.transaction_status || ''),
          amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
          currency: String(amount.currency_code || '').toUpperCase(),
          feeAmount: Number.isFinite(parsedFee) ? parsedFee : 0,
          feeCurrency: String(fee.currency_code || amount.currency_code || '').toUpperCase(),
          transactionEventCode: String(info.transaction_event_code || ''),
    paypalReferenceId: String(info.paypal_reference_id || ''),
    paypalReferenceIdType: String(info.paypal_reference_id_type || ''),
          transactionSubject: String(info.transaction_subject || ''),
          transactionNote: String(info.transaction_note || ''),
          transactionInitiationDate: info.transaction_initiation_date || '',
          transactionUpdatedDate: info.transaction_updated_date || '',
        };
        // Boundary-day and cross-page duplicates are never counted twice.
        resultsById.set(id, entry);
      }
      const pages = Number(data.total_pages);
      if (Number.isSafeInteger(pages) && pages >= 1) {
        if (page >= pages) { complete = true; break; }
      } else if (data.transaction_details.length < size) {
        complete = true;
        break;
      }
    }
    // An incomplete provider scan is not an empty or successful result.
    if (!complete) throw new Error('PayPal reporting exceeds safe page limit; narrow the scan window.');
    from = until;
  }
  return [...resultsById.values()];
}
