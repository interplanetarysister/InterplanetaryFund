import { isPublicCampaignFundraisingEnabled } from './fundraisingMode.ts';

// Public campaign payments are enabled only when the administrator has
// explicitly enabled the GLOBAL fundraising flag. No privileged bypass:
 // while off, even administrators must use the separate platform-support path.
export async function campaignPaymentAccess(base44: any) {
  const allowed = await isPublicCampaignFundraisingEnabled(base44);
  return { allowed, prelaunchTest: false, user: null };
}
