export const PUBLIC_IFUND_ORIGIN = "https://interplanetaryfund.com";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

function validCampaignId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

function safeImageUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href : "";
  } catch { return ""; }
}

const money = amount => {
  const parsed = Number(amount);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 100) / 100 : 0;
};

export function campaignPublicUrl(id) {
  if (!validCampaignId(id)) return "";
  return `${PUBLIC_IFUND_ORIGIN}/campaign/${encodeURIComponent(id)}`;
}

export function buildCampaignEmbed(campaign, platformOnly = true) {
  const url = campaignPublicUrl(campaign?.id);
  if (!url) return { url: "", card: "", button: "", previewImage: "" };
  const title = escapeHtml(String(campaign?.title || "Campaign").slice(0, 180));
  const summary = escapeHtml(String(campaign?.summary || "").slice(0, 380));
  const label = platformOnly ? "View campaign on Interplanetary Fund" : "Support campaign on Interplanetary Fund";
  const image = safeImageUrl(campaign?.cover_image_url) || `${PUBLIC_IFUND_ORIGIN}/ifund-logo.jpg`;
  const amount = money(campaign?.raised_amount);
  const goal = money(campaign?.goal_amount);
  const pct = goal > 0 ? Math.min(100, Math.round((amount / goal) * 100)) : 0;
  const dollars = num => num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  // Base44/IFund currently serves X-Frame-Options: DENY. A copied iframe would
  // always be blocked offsite. Export a self-contained, safe static HTML card
  // with no script, iframe, remote CSS or merchant payment behavior instead.
  // The permanent IFund campaign link always opens live totals and checkout.
  const card = [
    `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:block;max-width:360px;overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:#fff;color:#0f172a;font-family:Arial,Helvetica,sans-serif;text-decoration:none;box-shadow:0 6px 24px rgba(15,23,42,.12)">`,
    `<img src="${escapeHtml(image)}" alt="${title} campaign cover" style="width:100%;height:186px;object-fit:cover;display:block" loading="lazy"/>`,
    `<span style="display:block;padding:16px">`,
    `<strong style="display:block;font-size:19px;line-height:1.4;margin-bottom:8px">${title}</strong>`,
    ...(summary ? [`<span style="display:block;font-size:13px;line-height:1.5;color:#475569;margin-bottom:12px">${summary}</span>`] : []),
    `<span style="display:block;font-size:12px;color:#334155;margin:9px 0">${escapeHtml(dollars(amount))} raised${goal > 0 ? ` of ${escapeHtml(dollars(goal))}` : ""}</span>`,
    `<span style="display:block;height:8px;background:#e2e8f0;border-radius:8px;overflow:hidden"><span style="display:block;background:#6366f1;height:8px;width:${pct}%"></span></span>`,
    `<span style="display:block;background:#2563eb;border-radius:10px;text-align:center;font-size:14px;font-weight:700;color:#fff;padding:12px;margin-top:14px">${escapeHtml(label)}</span>`,
    `<small style="display:block;margin-top:12px;text-align:center;font-size:11px;color:#64748b">Powered by Interplanetary Fund</small>`,
    `</span></a>`,
  ].join("\n");
  const button = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#4f46e5;color:#ffffff;font-family:Arial,sans-serif;font-weight:700;text-decoration:none">${escapeHtml(label)}</a>`;
  return { url, card, button, previewImage: image };
}
