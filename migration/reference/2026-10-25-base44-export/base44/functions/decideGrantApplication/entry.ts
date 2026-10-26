import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { ensureCanonicalCampaign, recordCanonicalDonation } from '../../shared/base44Financial.ts';
import { reconcileDonationMirror } from '../../shared/financialMirrors.ts';
import { logAudit } from '../../shared/auditLog.ts';

// Decides a grant application (award / decline / under review). Verifies the
// caller owns the institution the application belongs to before updating, then
// notifies the applicant. Institutional awards are financial promises until the
// platform verifies receipt; they are therefore recorded as canonical PENDING
// operations and do not increase campaign totals or withdrawable funds yet.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const { application_id, status, decision_note } = await req.json();
    if (!application_id || !status) return Response.json({ error: 'Missing decision details' }, { status: 400 });

    const sr = base44.asServiceRole;
    const app = await sr.entities.GrantApplication.get(application_id);
    if (!app) return Response.json({ error: 'Application not found' }, { status: 404 });

    const institution = await sr.entities.Institution.get(app.institution_id).catch(() => null);
    if (!institution || institution.created_by_id !== user.id) {
      return Response.json({ error: 'Not authorized to decide this application' }, { status: 403 });
    }

    // On the transition into awarded, establish the durable canonical pending
    // operation BEFORE changing the application status. If any later write
    // fails, a retry reuses the same operation key and safely finishes instead
    // of leaving an awarded application with no financial record.
    if (status === 'awarded' && app.status !== 'awarded') {
      const amount = Number.parseFloat(app.requested_amount) || 0;
      if (amount > 0 && app.campaign_id) {
        const campaign = await sr.entities.Campaign.get(app.campaign_id).catch(() => null);
        if (!campaign) return Response.json({ error: 'Campaign not found for this grant award' }, { status: 404 });

        await ensureCanonicalCampaign(sr, campaign);
        const operationKey = `institutional_grant:${application_id}`;
        const canonical = await recordCanonicalDonation(sr, {
          operationKey,
          provider: 'institutional_grant',
          providerTransactionId: String(application_id),
          campaignId: app.campaign_id,
          campaignTitle: app.campaign_title || campaign.title,
          campaignOwnerUserId: campaign.created_by_id || '',
          grossAmount: amount,
          platformContribution: 0,
          processingFee: 0,
          donorName: app.institution_name || institution.name || 'Institutional Grant',
          ...(app.applicant_user_id ? { donorUserId: app.applicant_user_id } : {}),
          message: app.opportunity_title ? `Grant award: ${app.opportunity_title}` : 'Grant award',
          paymentMethod: 'other',
          paymentVerified: false,
          source: 'institutional_grant_award',
          isRecurring: false,
        });

        await reconcileDonationMirror(sr, canonical.operationId, {
          campaign_id: app.campaign_id,
          campaign_title: app.campaign_title || campaign.title,
          amount,
          platform_contribution: 0,
          processing_fee: 0,
          donor_name: app.institution_name || institution.name || 'Institutional Grant',
          message: app.opportunity_title ? `Grant award: ${app.opportunity_title}` : 'Grant award',
          ...(app.applicant_user_id ? { donor_user_id: app.applicant_user_id } : {}),
          payment_method: 'other',
          payment_verified: false,
          is_institutional: true,
          cleared: false,
          idempotency_key: String(application_id),
        });

        if (canonical.created) {
          await logAudit(base44, {
            action: 'institutional_award_pending_verification',
            target_type: 'grant_application',
            target_id: application_id,
            detail: `$${amount} institutional award recorded as pending receipt verification`,
            status: 'success',
            metadata: { canonical_operation_id: String(canonical.operationId), campaign_id: app.campaign_id },
          });
        }
      }
    }

    await sr.entities.GrantApplication.update(application_id, { status, decision_note: decision_note || '' });

    if (app.applicant_user_id) {
      await sr.entities.Notification.create({
        user_id: app.applicant_user_id,
        title: status === 'awarded' ? 'Your application was awarded' : `Application ${status.replace('_', ' ')}`,
        body: `${institution.name} updated your application for \"${app.opportunity_title}\"${decision_note ? `: ${decision_note}` : ''}`,
        type: 'system',
        link: '/institutions',
      });
    }

    return Response.json({ status, decision_note: decision_note || '' });
  } catch (error) {
    console.error('decideGrantApplication error:', error?.message || error);
    return Response.json({ error: 'Unable to record your decision safely. Please try again.' }, { status: 500 });
  }
}
