import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { donation_id } = body;

    if (!donation_id) return Response.json({ error: 'Missing donation_id' }, { status: 400 });

    const donation = await base44.asServiceRole.entities.Donation.get(donation_id);
    if (!donation) return Response.json({ error: 'Donation not found' }, { status: 404 });
    if (donation.status !== 'paid') return Response.json({ ok: true, skipped: true, reason: 'not paid' });

    const email = donation.donor_email;
    if (!email) return Response.json({ ok: true, skipped: true, reason: 'no donor email' });

    const campaign = donation.campaign_id
      ? await base44.asServiceRole.entities.Campaign.get(donation.campaign_id).catch(() => null)
      : null;
    const title = donation.campaign_title || campaign?.title || 'your campaign';
    const amount = Number(donation.amount || 0).toFixed(2);
    const currency = donation.currency || 'USD';
    const donorName = donation.donor_name && donation.donor_name !== 'Pending'
      ? donation.donor_name.split(' ')[0]
      : 'there';
    const summaryUrl = donation.summary_url || '#';
    const thankYou = campaign?.donor_thank_you || `Your generosity directly supports ${title}.`;

    const subject = `Thank you for supporting ${title}`;
    const html = `<div style="max-width:520px;margin:0 auto;font-family:ui-sans-serif,system-ui,sans-serif;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4">
      <div style="background:linear-gradient(135deg,#34d399,#0d9488);padding:32px 24px;text-align:center"><h1 style="color:#0B0F0E;margin:0;font-size:22px;font-weight:700;letter-spacing:0.02em">Thank You!</h1><p style="color:#0B0F0E;margin:6px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;opacity:0.85">Kindred · Fundraising OS</p></div>
      <div style="padding:28px 24px">
        <p style="color:#44403c;font-size:15px;line-height:1.6">Hi ${donorName},</p>
        <p style="color:#44403c;font-size:15px;line-height:1.6">Thank you for your generous donation of <strong>${currency} ${amount}</strong> to <strong>${title}</strong>. ${thankYou}</p>
        <p style="color:#44403c;font-size:14px;line-height:1.6">A full summary of your contribution is available anytime — keep it for your records or share your impact.</p>
        <a href="${summaryUrl}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;margin-top:16px">View Your Donation Summary</a>
      </div>
      <div style="padding:24px;text-align:center;color:#78716c;font-size:12px;border-top:1px solid #e7e5e4">© 2026 Kindred · AI-Powered Fundraising</div>
    </div>`;

    await base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: html });
    console.log('donor thank-you sent', { donation_id, email });
    return Response.json({ ok: true, sent: true });
  } catch (error) {
    console.error('send-donor-thankyou error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}