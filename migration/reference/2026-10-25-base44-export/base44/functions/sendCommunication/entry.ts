import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';
import { checkRateLimit } from '../../shared/rateLimit.ts';
import { assertPlatformAccess } from '../../shared/integrationRegistry.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const guard = await assertActiveAccount(base44);
    if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });
    const user = guard.user;

    // Centralized access gate: email delivery runs through the platform-managed
    // Core integration, but it is still gated by the email registry entry so an
    // admin can revoke it centrally. If registry verification is unavailable,
    // delivery fails closed rather than guessing that email is usable.
    const emailAccess = await assertPlatformAccess(base44.asServiceRole, 'email');
    if (!emailAccess.ok) return Response.json({ error: 'Email delivery is not available right now.' }, { status: 503 });

    const { campaign_id, subject, content, comm_type, audience, channels, ai_generated } = await req.json();
    if (!subject || !content || !channels || channels.length === 0) {
      return Response.json({ error: 'Subject, content and at least one channel are required' }, { status: 400 });
    }
    if (typeof subject !== 'string' || subject.length > 200) {
      return Response.json({ error: 'Subject must be 200 characters or fewer.' }, { status: 400 });
    }
    if (typeof content !== 'string' || content.length > 5000) {
      return Response.json({ error: 'Message must be 5000 characters or fewer.' }, { status: 400 });
    }

    // Only allow messaging donors of campaigns the sender owns
    const myCampaigns = await base44.entities.Campaign.filter({ created_by_id: user.id });
    const myIds = myCampaigns.map((c) => c.id);
    if (campaign_id && !myIds.includes(campaign_id)) {
      return Response.json({ error: 'You can only message donors of your own campaigns' }, { status: 403 });
    }
    const campaignIds = campaign_id ? [campaign_id] : myIds;
    if (campaignIds.length === 0) {
      return Response.json({ error: 'You have no campaigns yet' }, { status: 400 });
    }

    // Rate limit (persistent): prevent a single organizer from flooding supporters.
    const rl = await checkRateLimit(base44, `sendCommunication:${user.id}`, 5, 60);
    if (!rl.allowed) {
      return Response.json({ error: 'You are sending messages too quickly. Please wait a moment and try again.' }, { status: 429 });
    }

    // Resolve audience
    const donations = await base44.asServiceRole.entities.Donation.filter({ campaign_id: { $in: campaignIds } });
    // Supporter communications must come only from financially verified gifts.
    // Pending/manual reports are not evidence that someone is a donor and must
    // never place that person into a campaign messaging audience.
    let pool = (donations || []).filter((d) => d.payment_verified === true);
    if (audience === 'recurring_donors') {
      pool = pool.filter((d) => d.is_recurring && (d.recurring_status || 'active') === 'active');
    }
    const donorIds = [...new Set(pool.map((d) => d.donor_user_id).filter(Boolean))].filter((id) => id !== user.id);
    const recipients = donorIds.length
      ? await base44.asServiceRole.entities.User.filter({ id: { $in: donorIds } })
      : [];

    // Deliver, respecting each recipient's consent preferences
    let emailCount = 0;
    const notifications = [];
    for (const r of recipients) {
      const prefs = r.comm_prefs || {};
      if (channels.includes('email') && prefs.email_updates !== false && r.email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: r.email,
            subject,
            body: content,
            from_name: user.full_name || 'Interplanetary Fund',
          });
          emailCount++;
        } catch (e) {
          console.error('Email delivery failed for recipient:', e?.name || 'DeliveryError');
        }
      }
      if (channels.includes('in_app') && prefs.in_app_updates !== false) {
        notifications.push({
          user_id: r.id,
          title: subject,
          body: content.slice(0, 300),
          type: comm_type || 'update',
          link: campaign_id ? `/campaign/${campaign_id}` : '/discover',
        });
      }
    }
    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    // Record in the communication history
    const campaign = campaign_id ? myCampaigns.find((c) => c.id === campaign_id) : null;
    const message = await base44.entities.Message.create({
      campaign_id: campaign_id || '',
      campaign_title: campaign ? campaign.title : 'All my campaigns',
      subject,
      content,
      comm_type: comm_type || 'update',
      audience: audience || 'campaign_donors',
      channels,
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: recipients.length,
      email_count: emailCount,
      in_app_count: notifications.length,
      ai_generated: !!ai_generated,
    });

    return Response.json({
      ok: true,
      recipients: recipients.length,
      emails: emailCount,
      in_app: notifications.length,
      message_id: message.id,
    });
  } catch (error) {
    console.error('sendCommunication error:', error?.name || 'UnknownError');
    return Response.json({ error: 'Unable to send your message. Please try again.' }, { status: 500 });
  }
}