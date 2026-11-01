const COMPLETED_STATUSES = new Set([
  "success",
  "partial",
  "failed",
  "unavailable",
  "no_connections",
]);

const isNonNegativeFinite = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isNonNegativeInteger = (value) =>
  isNonNegativeFinite(value) && Number.isInteger(value);

export function parseExternalSyncResult(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Malformed sync response");
  }

  if (data.overall_status === "in_progress") {
    if (data.ok !== false || data.deduplicated !== true) throw new Error("Malformed sync response");
    return {
      overall_status: "in_progress",
      deduplicated: true,
      discovered_totals: [],
    };
  }

  if (!COMPLETED_STATUSES.has(data.overall_status)) {
    throw new Error("Malformed sync response");
  }

  const expectedOk = data.overall_status === "success" || data.overall_status === "partial";
  if (data.ok !== expectedOk ||
      typeof data.deduplicated !== "boolean" ||
      !isNonNegativeInteger(data.campaigns_covered) ||
      !isNonNegativeFinite(data.total_discovered) ||
      !isNonNegativeInteger(data.total_imported) ||
      data.withdrawable_imported !== 0 ||
      !Array.isArray(data.discovered_totals)) {
    throw new Error("Malformed sync response");
  }

  const currencies = new Set();
  const discoveredTotals = data.discovered_totals.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row) ||
        !(/^[A-Z]{3}$/.test(row.currency) || row.currency === "UNSPECIFIED") ||
        !isNonNegativeFinite(row.amount) ||
        currencies.has(row.currency)) {
      throw new Error("Malformed sync response");
    }
    currencies.add(row.currency);
    return { currency: row.currency, amount: row.amount };
  });

  const usdTotal = discoveredTotals.find((row) => row.currency === "USD")?.amount ?? 0;
  if (data.total_discovered !== usdTotal) {
    throw new Error("Malformed sync response");
  }

  return {
    overall_status: data.overall_status,
    campaigns_covered: data.campaigns_covered,
    total_discovered: data.total_discovered,
    total_imported: data.total_imported,
    discovered_totals: discoveredTotals,
  };
}
