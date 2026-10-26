import { jsPDF } from "jspdf";
import { format } from "date-fns";

export function downloadReceipt(donation) {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text("Interplanetary Fund — Donation Receipt", 20, 25);
  doc.setDrawColor(14, 165, 233);
  doc.setLineWidth(0.8);
  doc.line(20, 30, 190, 30);

  doc.setFontSize(11);
  const lines = [
    ["Receipt ID", donation.id],
    ["Date", format(new Date(donation.created_date), "MMMM d, yyyy")],
    ["Donor", donation.donor_name || "Anonymous"],
    ["Campaign", donation.campaign_title || donation.campaign_id],
    ["Gift to campaign", `${donation.amount.toLocaleString()}${donation.is_recurring ? " / month" : ""}`],
    ...(Number(donation.platform_support_amount || 0) > 0 ? [["Optional IFund support", `${Number(donation.platform_support_amount).toFixed(2)}`]] : []),
    ...(Number(donation.processing_fee || 0) > 0 ? [["Processor charge", `${Number(donation.processing_fee).toFixed(2)}`]] : []),
    ...(Number.isFinite(Number(donation.total_charged)) ? [["Total charged", `${Number(donation.total_charged).toFixed(2)}`]] : []),
    ["Type", donation.is_recurring ? "Recurring (monthly)" : "One-time"],
  ];
  let y = 45;
  lines.forEach(([label, value]) => {
    doc.setFont(undefined, "bold");
    doc.text(`${label}:`, 20, y);
    doc.setFont(undefined, "normal");
    doc.text(String(value), 65, y);
    y += 10;
  });

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Thank you for your generosity. Keep this receipt for your records.", 20, y + 10);
  doc.save(`interplanetary-fund-receipt-${donation.id}.pdf`);
}