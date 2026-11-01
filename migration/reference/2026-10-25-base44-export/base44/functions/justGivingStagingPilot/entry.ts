import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { createUnclaimedPayload, createJustGivingStagingPage, pageSlug } from '../../shared/justGivingUnclaimed.js';

// Controlled, staging-only proof of JustGiving's officially documented
// Unclaimed Fundraising Pages PUT API. This is not a production integration.
// No user passwords, donations, transfers, or provider claim tokens are stored.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Staging integration is in administrator testing only.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'readiness');
    const configured = !!Deno.env.get('JUSTGIVING_APP_ID');
    const stagingEnabled = Deno.env.get('JUSTGIVING_STAGING_WRITE_ENABLED') === 'true';
    if (action === 'readiness') {
      return Response.json({
        provider: 'justgiving', environment: 'staging', app_id_present: configured,
        staging_write_enabled: stagingEnabled,
        ready: configured && stagingEnabled,
        external_campaign_creation_live: false,
        required: ['registered JustGiving AppID', 'eligible charity ID', 'campaign owner review',
          'JustGiving-supported activity', 'provider test/claim verification'],
        source: 'https://api.justgiving.com/docs/resources/v1/UnclaimedPages/RegisterFundraisingPage',
      });
    }
    if (!['preview','create_staging'].includes(action))
      return Response.json({ error: 'Unsupported JustGiving staging action.' }, { status: 400 });
    const campaignId = String(body.campaign_id || '').trim();
    if (!campaignId) return Response.json({ error: 'Select an IFund campaign.' }, { status: 400 });
    const campaign = await base44.entities.Campaign.get(campaignId).catch(() => null);
    if (!campaign || campaign.created_by_id !== user.id)
      return Response.json({ error: 'Only the campaign owner can prepare this page.' }, { status: 403 });
    if (!['active','draft'].includes(campaign.status))
      return Response.json({ error: 'This campaign cannot be used for staging registration.' }, { status: 409 });

    let payload;
    try {
      payload = createUnclaimedPayload(campaign, {
        charity_id: body.charity_id,
        activity_type: body.activity_type,
        currency: body.currency,
        target_amount: body.target_amount,
        confirm_target_amount: body.confirm_target_amount === true,
      });
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    // Preview never calls JustGiving or creates an IFund record.
    if (action === 'preview')
      return Response.json({
        ok: true, preview_only: true, environment: 'staging',
        page_short_name: pageSlug(campaign), charity_id: payload.charityId,
        page_title: payload.pageTitle, target_amount: payload.targetAmount,
        currency: payload.currency, activity_type: payload.activityType,
        note: 'Preview only. No external page was created, and a charity must be eligible to fundraise on JustGiving.',
      });

    if (!configured || !stagingEnabled)
      return Response.json({
        ok: false, code: 'staging_configuration_required',
        error: 'JustGiving staging writes are not enabled for IFund. No external page was created.',
      }, { status: 409 });
    if (body.confirm_staging_creation !== true || body.confirm_charity_eligibility !== true ||
        body.confirm_provider_terms !== true)
      return Response.json({ error: 'Explicit staging creation, charity eligibility and provider terms confirmations are required.' }, { status: 403 });

    // A successful prior staging registration must never be repeated by this endpoint.
    const sr = base44.asServiceRole;
    let prior;
    try {
      prior = await sr.entities.ExternalCampaignPublication.filter({
        campaign_id: campaignId, owner_user_id: user.id, platform: 'justgiving', environment: 'staging',
      });
      if (!Array.isArray(prior)) throw new Error('Invalid publication history');
    } catch (_) {
      return Response.json({
        ok: false, code: 'publication_history_unavailable',
        error: 'Cannot verify prior JustGiving staging registrations. No new page has been requested; retry when IFund records are available.',
      }, { status: 503 });
    }
    const existing = prior.find(x => x.status === 'staging_created');
    if (existing)
      return Response.json({
        ok: true, duplicate: true, environment: 'staging', status: 'staging_created',
        page_url: existing.provider_page_url, page_id: existing.provider_page_id,
        claim_url: '', claim_link_note: 'The original one-time claim link is not stored. Check your JustGiving developer account.',
      });

    if (prior.length) {
      return Response.json({
        ok: false, code: 'prior_registration_requires_review',
        error: 'A JustGiving staging request is already recorded for this campaign. Review its status before attempting another provider registration.',
      }, { status: 409 });
    }
    // Record an attempt BEFORE the external PUT. If the provider succeeds but
    // a network timeout prevents receiving its answer, do not automatically
    // retry or falsely claim no page was created.
    let reservation;
    try {
      reservation = await sr.entities.ExternalCampaignPublication.create({
        campaign_id: campaign.id, owner_user_id: user.id,
        platform: 'justgiving', environment: 'staging', status: 'request_pending',
        page_short_name: payload.pageShortName, provider_charity_id: String(payload.charityId),
        registration_method: 'unclaimed_page_staging_api',
        test_note: 'Provider request reserved. If result is unknown, manually reconcile before another test.',
      });
      if (!reservation?.id) throw new Error('Reservation missing ID');
    } catch (_) {
      return Response.json({
        ok: false, code: 'record_reservation_failed',
        error: 'IFund could not reserve this staging registration. No provider request was sent.',
      }, { status: 503 });
    }
    let attempted;
    try {
      attempted = await createJustGivingStagingPage({
        appId: Deno.env.get('JUSTGIVING_APP_ID'), payload,
      });
    } catch (_) {
      await sr.entities.ExternalCampaignPublication.update(reservation.id, {
        status: 'needs_attention', test_note: 'Provider outcome unknown. Check staging page by short name before any retry.',
      }).catch(() => {});
      return Response.json({
        ok: false, code: 'staging_outcome_unknown',
        error: 'JustGiving did not return a verified creation result. A page may have been created. Check JustGiving before attempting another registration.',
      }, { status: 502 });
    }
    if (!attempted.ok) {
      await sr.entities.ExternalCampaignPublication.update(reservation.id, {
        status: 'needs_attention', test_note: 'Provider returned ' + attempted.status + '; human review required before retry.',
      }).catch(() => {});
      return Response.json({
        ok: false, status: attempted.status,
        error: attempted.status === 'provider_conflict'
          ? 'JustGiving reports a conflicting page short name or provider eligibility. No successful new registration was confirmed.'
          : 'JustGiving did not confirm page creation in staging.',
      }, { status: attempted.status === 'provider_conflict' ? 409 : 502 });
    }

    let persisted = false;
    try {
      await sr.entities.ExternalCampaignPublication.update(reservation.id, {
        status: 'staging_created',
        provider_page_id: attempted.page_id, provider_page_url: attempted.page_url,
        provider_verified_at: new Date().toISOString(),
        test_note: 'Staging only. Owner claim and production authorization not verified.',
      });
      persisted = true;
    } catch (_) {
      // Do not retry a successful provider write automatically if recording fails.
      console.error('JustGiving staging creation succeeded but recording failed');
    }
    return Response.json({
      ok: true, status: 'staging_created', environment: 'staging',
      page_url: attempted.page_url, page_id: attempted.page_id,
      claim_url: attempted.claim_url,
      stored: persisted,
      note: persisted
        ? 'Staging page created by JustGiving. The recipient must claim it on JustGiving. No production fundraising is live.'
        : 'Staging page created but IFund could not save the record. Do not retry automatically; use the claim link and contact IFund support.',
    });
  } catch (error) {
    console.error('JustGiving staging pilot request failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Could not prepare the JustGiving staging request safely.' }, { status: 500 });
  }
}
