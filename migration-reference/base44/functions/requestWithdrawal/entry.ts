import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendPayout } from '../../shared/paypal.ts';

// Withdrawal engine. Enforces the 8% platform fee, the 7-day clearing hold,
// a once-daily limit, campaign ownership, and fraud review for large payouts.
// All payouts go out of the platform's PayPal business account.
const PLATFORM_FEE_RATE = 0.08;
const CLEARING_DAYS = 7;
const REVIEW_THRESHOLD = 1000; // net amounts above this require admin approval

const round2 = (n) => Math.round(n * 100) / 100;
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Sign in to withdraw funds." }, { status: 401 });

    const body = await req.json();
    const action = body.action || "request";

    // ---- Admin: clear an institutional donation for withdrawal ----
    if (action === "clear") {
      if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
      const d = await sr.entities.Donation.get(body.donation_id);
      if (!d) return Response.json({ error: "Donation not found." }, { status: 404 });
      if (!d.is_institutional) return Response.json({ error: "Only institutional donations need clearing." }, { status: 400 });
      await sr.entities.Donation.update(d.id, { cleared: true });
      return Response.json({ ok: true, donation_id: d.id, cleared: true });
    }

    // ---- Admin: approve a withdrawal held for review ----
    if (action === "approve") {
      if (user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
      const w = await sr.entities.Withdrawal.get(body.withdrawal_id);
      if (!w) return Response.json({ error: "Withdrawal not found." }, { status: 404 });
      if (w.status !== "under_review") return Response.json({ error: "Only held withdrawals can be approved." }, { status: 400 });
      try {
        const payout = await sendPayout({
          receiver: w.paypal_email,
          amount: w.net_amount,
          note: `Interplanetary Fund withdrawal for "${w.campaign_title}"`,
          itemId: `IFW_${w.id}`,
        });
        await sr.entities.Withdrawal.update(w.id, {
          status: "paid",
          payout_batch_id: payout.payout_batch_id,
          processed_at: new Date().toISOString(),
        });
        return Response.json({ ok: true, status: "paid", payout_batch_id: payout.payout_batch_id });
      } catch (err) {
        await sr.entities.Withdrawal.update(w.id, { status: "failed", review_note: err.message });
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // ---- User: request a new withdrawal ----
    const { campaign_id, paypal_email, paypal_email_confirm } = body;
    if (!campaign_id) return Response.json({ error: "Select a campaign to withdraw from." }, { status: 400 });
    if (!emailOk(paypal_email)) return Response.json({ error: "Enter a valid PayPal email address." }, { status: 400 });
    if (paypal_email !== paypal_email_confirm) return Response.json({ error: "PayPal email addresses do not match." }, { status: 400 });

    const campaign = await sr.entities.Campaign.get(campaign_id);
    if (!campaign) return Response.json({ error: "Campaign not found." }, { status: 404 });
    if (campaign.created_by_id !== user.id) {
      return Response.json({ error: "You can only withdraw funds from your own campaigns." }, { status: 403 });
    }

    // Once-daily limit: any non-failed withdrawal created today blocks a new one.
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const recent = await sr.entities.Withdrawal.filter({ owner_user_id: user.id });
    const alreadyToday = (recent || []).some((w) => {
      if (w.status === "failed") return false;
      return new Date(w.created_date) >= startToday;
    });
    if (alreadyToday) {
      return Response.json({ error: "You can only withdraw once per day. Please try again tomorrow." }, { status: 400 });
    }

    // Cleared, unconsumed donations (7-day holding period for fraud protection).
    const cutoff = new Date(Date.now() - CLEARING_DAYS * 86400000);
    const allDonations = await sr.entities.Donation.filter({ campaign_id });
    // Cleared, unconsumed donations. Regular gifts clear after the 7-day holding
    // period; institutional (grant) gifts require explicit admin clearing first.
    const available = (allDonations || []).filter((d) => !d.withdrawal_id && (d.is_institutional ? d.cleared : new Date(d.created_date) <= cutoff));
    const gross = round2(available.reduce((s, d) => s + (d.amount || 0), 0));
    if (gross <= 0) {
      return Response.json({ error: "No cleared funds are available yet. Donations become withdrawable after a 7-day clearing period." }, { status: 400 });
    }

    const fee = round2(gross * PLATFORM_FEE_RATE);
    const net = round2(gross - fee);

    const withdrawal = await sr.entities.Withdrawal.create({
      owner_user_id: user.id,
      user_name: user.full_name,
      campaign_id,
      campaign_title: campaign.title,
      gross_amount: gross,
      platform_fee: fee,
      net_amount: net,
      paypal_email,
      covered_donation_ids: available.map((d) => d.id),
      status: "processing",
    });

    // Reserve the donations so they can never be withdrawn twice.
    await sr.entities.Donation.bulkUpdate(available.map((d) => ({ id: d.id, withdrawal_id: withdrawal.id })));

    // Large payouts are held for manual admin review (fraud protection).
    if (net > REVIEW_THRESHOLD) {
      await sr.entities.Withdrawal.update(withdrawal.id, {
        status: "under_review",
        review_note: `Net amount $${net.toFixed(2)} exceeds the $${REVIEW_THRESHOLD} auto-approval threshold.`,
      });
      return Response.json({ ok: true, status: "under_review", withdrawal_id: withdrawal.id, gross, fee, net });
    }

    try {
      const payout = await sendPayout({
        receiver: paypal_email,
        amount: net,
        note: `Interplanetary Fund withdrawal for "${campaign.title}"`,
        itemId: `IFW_${withdrawal.id}`,
      });
      await sr.entities.Withdrawal.update(withdrawal.id, {
        status: "paid",
        payout_batch_id: payout.payout_batch_id,
        processed_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, status: "paid", withdrawal_id: withdrawal.id, gross, fee, net, payout_batch_id: payout.payout_batch_id });
    } catch (err) {
      // Payout failed — release the reserved donations so the user can retry.
      await sr.entities.Donation.bulkUpdate(available.map((d) => ({ id: d.id, withdrawal_id: "" })));
      await sr.entities.Withdrawal.update(withdrawal.id, { status: "failed", review_note: err.message });
      return Response.json({ error: `Payout failed: ${err.message}. Your funds were released back to your available balance.` }, { status: 500 });
    }
  } catch (error) {
    console.error("requestWithdrawal error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}