// Automated donation receipt emails.
//
// Sends an HTML receipt to the donor the moment a donation is verified by an
// authorized provider/server path (Stripe webhook, PayPal capture, or admin
// clearing of a manual gift). Never called for pending unverified donations.
//
// Receipts are delivered as a formatted HTML email so they render on every
// device and mail client without requiring an attachment download. The email
// is fire-and-forget: a failure to send never blocks the financial operation.

function money(n) {
  const v = Number(n || 0);
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value) {
  try {
    return new Date(value || Date.now()).toLocaleString(undefined, {
      year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch (_) {
    return new Date().toLocaleString();
  }
}

function providerLabel(method) {
  switch (String(method || "").toLowerCase()) {
    case "stripe": return "Card (Stripe)";
    case "paypal": return "PayPal";
    case "cashapp": return "Cash App";
    case "googlepay": return "Google Pay via PayPal";
    case "applepay": return "Apple Pay via PayPal";
    default: return "Interplanetary Fund";
  }
}

export async function sendDonationReceipt(sr, donation, campaign) {
  // Only verified donations receive an automated receipt.
  if (!donation || donation.payment_verified === false) return { sent: false, reason: "unverified" };

  const email = donation.donor_email;
  if (!email) return { sent: false, reason: "no_email" };

  const title = campaign?.title || donation.campaign_title || "Interplanetary Fund campaign";
  const donorName = donation.donor_name || "Friend";
  const contribution = Number(donation.platform_contribution || 0);
  const gift = Math.max(0, Number(donation.amount || 0) - contribution);
  const amount = money(gift);
  const fee = Number(donation.processing_fee || 0);
  // Donation.amount already INCLUDES the platform contribution; never add twice.
  const total = Number(donation.amount || 0) + fee;
  const isRecurring = !!donation.is_recurring;
  const receiptId = String(donation.id || donation.canonical_operation_id || "").slice(0, 12).toUpperCase();
  const date = dateLabel(donation.created_date);

  const rows = [
    ["Receipt ID", receiptId || "—"],
    ["Date", date],
    ["Campaign", title],
    ["Donor", donorName],
    ["Gift amount", amount],
    isRecurring ? ["Type", "Recurring (monthly)"] : ["Type", "One-time"],
    ...(contribution > 0 ? [["Platform contribution", money(contribution)]] : []),
    ...(fee > 0 ? [["Processing fee", money(fee)]] : []),
    ["Total charged", money(total)],
    ["Payment method", providerLabel(donation.payment_method)],
  ];

  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px;color:#64748b;font-size:13px;width:42%;border-bottom:1px solid #f1f5f9;">${label}</td>
      <td style="padding:10px 16px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #f1f5f9;">${value}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);border-radius:20px 20px 0 0;padding:28px 28px 24px;color:#fff;">
        <p style="margin:0;font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:.85;">Interplanetary Fund</p>
        <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;">Donation Receipt</h1>
        <p style="margin:6px 0 0;opacity:.9;font-size:14px;">Thank you, ${donorName}. Your generosity makes a difference.</p>
      </div>
      <div style="background:#fff;border-radius:0 0 20px 20px;border:1px solid #e2e8f0;border-top:0;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
        <div style="padding:20px 28px;background:#f8fafc;">
          <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">Your gift directly supports <strong style="color:#0f172a;">${title}</strong>. Keep this receipt for your records${isRecurring ? ". Your recurring gift will process monthly until you cancel" : ""}.</p>
        </div>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:20px;line-height:1.5;">Interplanetary Fund · Endless possibilities start with one question: What if?<br/>This is an automated receipt for a verified donation.</p>
    </div></body></html>`;

  const text = `Interplanetary Fund — Donation Receipt\n\nThank you, ${donorName}.\n\nReceipt ID: ${receiptId || "—"}\nDate: ${date}\nCampaign: ${title}\nGift amount: ${amount}\n${isRecurring ? "Type: Recurring (monthly)\n" : "Type: One-time\n"}${contribution > 0 ? `Platform contribution: ${money(contribution)}\n` : ""}${fee > 0 ? `Processing fee: ${money(fee)}\n` : ""}Total charged: ${money(total)}\nPayment method: ${providerLabel(donation.payment_method)}\n\nYour gift directly supports ${title}. Keep this receipt for your records.\n\nInterplanetary Fund — Endless possibilities start with one question: What if?`;

  try {
    await sr.integrations.Core.SendEmail({
      to: email,
      subject: `Your donation receipt — ${title}`,
      html,
      text,
      from_name: "Interplanetary Fund",
    });
    return { sent: true };
  } catch (error) {
    console.error("sendDonationReceipt error:", error?.message || error);
    return { sent: false, reason: "send_failed" };
  }
}