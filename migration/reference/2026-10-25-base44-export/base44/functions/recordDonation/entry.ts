import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { logAudit } from '../../shared/auditLog.ts';
import { computeContribution, validateDonationAmount } from '../../shared/fees.js';
import { assertActiveAccountIfSignedIn } from '../../shared/accountGuard.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { ensureCanonicalCampaign, recordCanonicalDonation } from '../../shared/base44Financial.ts';
import { reconcileDonationMirror } from '../../shared/financialMirrors.ts';
import { isPublicCampaignFundraisingEnabled } from '../../shared/fundraisingMode.ts';
import { isFeatureEnabled, featureUnavailable } from '../../shared/featureFlagGate.ts';

// Records a supporter-reported manual PayPal/Cash App gift as PENDING only.
// There is no provider-side proof on this path, so it must never increment the
// campaign, donor count, canonical ledger, or creator notification until an
// admin confirms that the off-platform payment actually arrived.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (!(await isPublicCampaignFundraisingEnabled(base44))) return Response.json({ error: 'Campaign donations are currently paused. The platform remains open for campaigns and sharing.' }, { status: 409 });
    if (!(await isFeatureEnabled(base44, 'payment_checkout_enabled'))) return featureUnavailable('New campaign payments');
    const sr = base44.asServiceRole;

    const donorGuard = await assertActiveAccountIfSignedIn(base44);
    if (!donorGuard.ok) return Response.json({ error: donorGuard.error }, { status: donorGuard.status });
    const donor = donorGuard.donor;

    const {
      campaign_id,
      amount,
      donor_name,
      message,
      is_recurring,
      payment_method,
      idempotency_key,
      platform_contribution,
    } = await req.json();

    const amountCheck = validateDonationAmount(amount);
    if (!amountCheck.ok) return Response.json({ error: amountCheck.error }, { status: 400 });
    if (!campaign_id) return Response.json({ error: 'A campaign is required' }, { status: 400 });
    if (!idempotency_key || !String(idempotency_key).trim()) {
      return Response.json({ error: 'A stable donation intent is required. Please reopen the donation form and try again.' }, { status: 400 });
    }

    const method = payment_method === 'cashapp' ? 'cashapp' : 'paypal';
    const provider = `manual_${method}`;
    const value = Number(amount);

    const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anon').split(',')[0].trim();
    const rl = await checkRateLimit(base44, `recordDonation:${donor?.id || ip}`, 10, 60);
    if (!rl.allowed) return Response.json({ error: 'Too many attempts. Please slow down and try again.' }, { status: 429 });

    const campaign = await sr.entities.Campaign.get(campaign_id).catch(() => null);
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.status !== 'active') return Response.json({ error: 'This campaign is not accepting donations.' }, { status: 400 });

    // Ensure every active app campaign has a stable canonical identity before
    // any financial operation is accepted. This does not copy app-side totals.
    await ensureCanonicalCampaign(sr, campaign);

    const contribution = computeContribution(value, !!platform_contribution);
    const displayName = donor_name || donor?.full_name || 'Anonymous';
    const operationKey = `${provider}:${String(idempotency_key).trim()}`;

    const canonical = await recordCanonicalDonation(sr, {
      operationKey,
      provider,
      providerTransactionId: String(idempotency_key).trim(),
      campaignId: campaign_id,
      campaignTitle: campaign.title,
      campaignOwnerUserId: campaign.created_by_id || '',
      grossAmount: value,
      platformContribution: contribution,
      processingFee: 0,
      donorName: displayName,
      ...(donor?.email ? { donorEmail: donor.email } : {}),
      ...(donor?.id ? { donorUserId: donor.id } : {}),
      message: message || '',
      paymentMethod: method,
      paymentVerified: false,
      source: 'manual_confirmation',
      isRecurring: !!is_recurring,
    });

    const donation = await reconcileDonationMirror(sr, canonical.operationId, {
      campaign_id,
      campaign_title: campaign.title,
      amount: value,
      platform_contribution: contribution,
      processing_fee: 0,
      donor_name: displayName,
      message: message || '',
      is_recurring: !!is_recurring,
      ...(is_recurring ? { recurring_status: 'active' } : {}),
      ...(donor?.id ? { donor_user_id: donor.id } : {}),
      payment_verified: false,
      cleared: false,
      payment_method: method,
      idempotency_key: String(idempotency_key).trim(),
    });

    await logAudit(base44, {
      action: 'donation_pending_verification',
      target_type: 'campaign',
      target_id: campaign_id,
      detail: `$${value} via ${method} recorded as pending provider verification`,
      status: 'success',
      metadata: { canonical_operation_id: String(canonical.operationId) },
    });

    return Response.json({
      ok: true,
      pending_verification: true,
      duplicate: canonical.status === 'pending_duplicate',
      donation_id: donation?.id,
      canonical_operation_id: String(canonical.operationId),
    });
  } catch (error) {
    console.error('recordDonation error:', error?.message || error);
    return Response.json({ error: 'Unable to record your donation safely. Please try again or contact support.' }, { status: 503 });
  }
}
