import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function buildEmail(template, ctx) {
  const { campaign_title, campaign_url, organizer_name, amount, donor_name, milestone, days_left } = ctx;
  const header = `<div style="background:linear-gradient(135deg,#34d399,#0d9488);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0"><h1 style="color:#0B0F0E;margin:0;font-size:22px;font-weight:700;letter-spacing:0.02em">Kindred</h1><p style="color:#0B0F0E;margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;opacity:0.8">Fundraising OS</p></div>`;
  const footer = `<div style="padding:24px;text-align:center;color:#78716c;font-size:12px;border-top:1px solid #e7e5e4;margin-top:8px">© 2026 Kindred · AI-Powered Fundraising</div>`;
  const btn = (label) => `<a href="${campaign_url || '#'}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;margin-top:16px">${label}</a>`;

  let subject = 'Kindred update';
  let body = '';
  if (template === 'campaign_created') {
    subject = `Your campaign "${campaign_title}" is live!`;
    body = `<p style="color:#44403c;font-size:15px;line-height:1.6">Hi ${organizer_name || 'there'},</p><p style="color:#44403c;font-size:15px;line-height:1.6">Your fundraiser <strong>${campaign_title}</strong> is now live on Kindred. Share it with your community to start raising funds.</p>${btn('View Campaign')}`;
  } else if (template === 'donation_receipt') {
    subject = `Receipt for your $${amount} donation`;
    body = `<p style="color:#44403c;font-size:15px;line-height:1.6">Hi ${donor_name || 'there'},</p><p style="color:#44403c;font-size:15px;line-height:1.6">Thank you for your generous donation of <strong>$${amount}</strong> to <strong>${campaign_title}</strong>. Your support makes a real difference.</p>${btn('View Campaign')}`;
  } else if (template === 'milestone_reached') {
    subject = `Milestone reached: ${milestone} of "${campaign_title}"`;
    body = `<p style="color:#44403c;font-size:15px;line-height:1.6">Great news! Your campaign <strong>${campaign_title}</strong> has reached <strong>${milestone}</strong> of its funding goal. Keep sharing to maintain momentum.</p>${btn('View Campaign')}`;
  } else if (template === 'ending_soon') {
    subject = `Your campaign ends in ${days_left} hours`;
    body = `<p style="color:#44403c;font-size:15px;line-height:1.6">Your campaign <strong>${campaign_title}</strong> is ending soon — about <strong>${days_left} hours</strong> left. This is the final push to reach your goal.</p>${btn('View Campaign')}`;
  } else {
    body = `<p style="color:#44403c;font-size:15px;line-height:1.6">You have a new update on Kindred.</p>`;
  }

  const html = `<div style="max-width:520px;margin:0 auto;font-family:ui-sans-serif,system-ui,sans-serif;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4">${header}<div style="padding:28px 24px">${body}</div>${footer}</div>`;
  return { subject, html };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { template, to, campaign_title, campaign_url, amount, donor_name, organizer_name, milestone, days_left } = body;
    if (!to) return Response.json({ error: 'Missing recipient' }, { status: 400 });

    const { subject, html } = buildEmail(template, { campaign_title, campaign_url, amount, donor_name, organizer_name, milestone, days_left });
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body: html });
    return Response.json({ ok: true, sent: true });
  } catch (error) {
    console.error('sendCampaignEmail error', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}