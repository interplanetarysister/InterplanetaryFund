import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { campaignForResponse } from '../../shared/campaignResponse.ts';
import { enforceImagePolicy, validIfundMediaUrl } from '../../shared/serverImagePolicy.ts';

const ALLOWED = new Set(['title','summary','story','category','goal_amount','status','cover_image_url','cover_image_is_ai','end_date','location','location_lat','location_lng','ai_profile','story_versions','draft_step','accept_crypto_donations']);
const STATUSES = new Set(['draft','active','paused','completed']);

class CampaignCoverError extends Error {}
async function prepareCampaignCover(base44, user, url, status) {
  if (!url) return '';
  const safeUrl = validIfundMediaUrl(url);
  if (!safeUrl) throw new CampaignCoverError('Please upload a cover image through IFund, or remove the image and retry.');
  // Private drafts must remain saveable even if image processing is temporarily
  // unavailable. Public campaigns receive the verified server-side watermark.
  if (status === 'draft') return safeUrl;
  try {
    return await enforceImagePolicy(base44, user, safeUrl);
  } catch {
    throw new CampaignCoverError('The cover image could not be processed. Try uploading it again, or remove it and launch without a cover.');
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;
    const body = await req.json().catch(() => ({}));
    const campaignId = String(body?.campaign_id || '').trim();
    const input = body?.campaign && typeof body.campaign === 'object' && !Array.isArray(body.campaign) ? body.campaign : null;
    if (!input || Object.keys(input).some((k) => !ALLOWED.has(k))) return Response.json({ error: 'Invalid campaign payload' }, { status: 400 });

    const title = String(input.title || '').trim();
    const goal = input.goal_amount === '' || input.goal_amount == null ? 0 : Number(input.goal_amount);
    const status = String(input.status || 'draft');
    if (!STATUSES.has(status) || !Number.isFinite(goal) || goal < 0 ||
        typeof input.ai_profile !== 'undefined' &&
          (!input.ai_profile || typeof input.ai_profile !== 'object' || Array.isArray(input.ai_profile)) ||
        typeof input.story_versions !== 'undefined' &&
          (!Array.isArray(input.story_versions) || input.story_versions.length > 50) ||
        typeof input.draft_step !== 'undefined' &&
          (!Number.isInteger(input.draft_step) || input.draft_step < 0 || input.draft_step > 3))
      return Response.json({ error: 'Invalid campaign information' }, { status: 400 });
    if (status !== 'draft' && (!title || goal <= 0 || !String(input.story || input.summary || '').trim()))
      return Response.json({ error: 'Add a campaign title, funding goal, and story before publishing.' }, { status: 400 });

    // Blank title and zero goal are valid PRIVATE drafts, not published campaigns.
    // Persist AI instructions/story versions and wizard position along with the
    // visible fields so saving early never discards another step's work.
    const safe = { ...input, title, goal_amount: goal, status };
    if ('cover_image_is_ai' in safe) safe.cover_image_is_ai = safe.cover_image_is_ai === true;
    if ('accept_crypto_donations' in safe) safe.accept_crypto_donations = safe.accept_crypto_donations === true;
    if (campaignId) {
      const rows = await base44.asServiceRole.entities.Campaign.filter({ id: campaignId });
      const existing = rows?.[0];
      if (!existing) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      if (existing.created_by_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Not authorized' }, { status: 403 });
      if (safe.cover_image_url && (safe.cover_image_url !== existing.cover_image_url || (existing.status === 'draft' && status !== 'draft')))
        safe.cover_image_url = await prepareCampaignCover(base44, user, safe.cover_image_url, status);
      await base44.asServiceRole.entities.Campaign.update(campaignId, safe);
      return Response.json({
        ok: true,
        campaign: campaignForResponse({ ...existing, ...safe, id: campaignId }),
        created: false,
      });
    }

    if (safe.cover_image_url) safe.cover_image_url = await prepareCampaignCover(base44, user, safe.cover_image_url, status);
    // The server has independently checked the account; ensure its identity
    // becomes the authoritative owner even for newly registered members.
    const created = await base44.asServiceRole.entities.Campaign.create({ ...safe, created_by_id: user.id });
    return Response.json({ ok: true, campaign: campaignForResponse(created), created: true });
  } catch (error) {
    console.error('saveCampaign failed:', error?.name || 'UnknownError');
    if (error instanceof CampaignCoverError) return Response.json({ error: error.message }, { status: 422 });
    return Response.json({ error: 'Campaign could not be saved safely.' }, { status: 500 });
  }
}