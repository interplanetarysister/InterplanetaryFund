import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isPublicCampaignFundraisingEnabled } from '../../shared/fundraisingMode.ts';

// Public status only; never disclose flags, admin identity or payment secrets.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const enabled = await isPublicCampaignFundraisingEnabled(base44);
    return Response.json({ public_campaign_fundraising: enabled }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('getFundraisingMode failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ public_campaign_fundraising: false, error: 'Fundraising status temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
