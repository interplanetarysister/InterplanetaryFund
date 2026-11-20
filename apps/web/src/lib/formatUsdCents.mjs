// Shared, dependency-free money formatter for financial surfaces.
// A missing amount must never be presented as a verified $0.00 balance.
export const formatUsdCents = (value) => {
  if (value === null || value === undefined || typeof value === "boolean") return "Not reported";
  if (typeof value !== "number" && typeof value !== "string") return "Not reported";
  if (typeof value === "string" && !/^(0|[1-9]\d*)$/.test(value.trim())) return "Not reported";
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 0) return "Not reported";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
};

export default formatUsdCents;
