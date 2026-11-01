import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { resolveDonationDestination } from '../../shared/distributionDestination.js';

const CASHTAG = /^[A-Za-z0-9_]{1,20}$/;
const ALLOWED = new Set(['cashapp_tag','outreach_enabled','outreach_paused','ai_profile','accept_crypto_donations','distribution_donation_connection_id']);

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id || '').trim();
    const patch = body?.patch && typeof body.patch === 'object' && !Array.isArray(body.patch) ? body.patch : null;
    if (!campaignId || !patch) return Response.json({ error: 'Invalid request' }, { status: 400 });

    const keys = Object.keys(patch);
    if (!keys.length || keys.some((key) => !ALLOWED.has(key))) {
      return Response.json({ error: 'Unsupported campaign setting' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.Campaign.filter({ id: campaignId });
    const campaign = rows?.[0];
    if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Not authorized' }, { status: 403 });
    }

    const safe = {};
    if ('distribution_donation_connection_id' in patch) {
      // Never let an administrator silently change another creator's donor destination.
      if (campaign.created_by_id !== user.id) return Response.json({ error: 'Only the campaign owner can select where supporters donate.' }, { status: 403 });
      const selectedId = String(patch.distribution_donation_connection_id || '').trim();
      try { await resolveDonationDestination(base44.asServiceRole, user.id, campaignId, selectedId); }
      catch (error) { return Response.json({ error: error.message }, { status: 409 }); }
      safe.distribution_donation_connection_id = selectedId;
    }
    if ('cashapp_tag' in patch) {
      const tag = String(patch.cashapp_tag || '').replace(/^\$/, '').trim();
      if (tag && !CASHTAG.test(tag)) return Response.json({ error: 'Invalid Cashtag' }, { status: 400 });
      safe.cashapp_tag = tag;
    }
    if ('accept_crypto_donations' in patch) safe.accept_crypto_donations = patch.accept_crypto_donations === true;
    if ('outreach_enabled' in patch) safe.outreach_enabled = patch.outreach_enabled === true;
    if ('outreach_paused' in patch) safe.outreach_paused = patch.outreach_paused === true;
    if ('ai_profile' in patch) {
      if (!patch.ai_profile || typeof patch.ai_profile !== 'object' || Array.isArray(patch.ai_profile)) {
        return Response.json({ error: 'Invalid AI profile' }, { status: 400 });
      }
      safe.ai_profile = patch.ai_profile;
    }

    await base44.asServiceRole.entities.Campaign.update(campaignId, safe);
    return Response.json({ ok: true, campaign_id: campaignId, updated: Object.keys(safe) });
  } catch (error) {
    console.error('updateCampaignSettings failed:', error?.name || 'UnknownError');
    return Response.json({ error: 'Campaign settings could not be updated safely.' }, { status: 500 });
  }
}