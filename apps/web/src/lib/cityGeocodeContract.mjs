// Shared browser/Worker contract. A city lookup never accepts an address/GPS
// point and never grants map opt-in or changes a persisted campaign.
export function normalizeCityQuery(value) {
  if (typeof value === "string" && /[\u0000-\u001f\u007f]/u.test(value))
    throw new Error("Enter a city and optional region, without a street address or postal code.");
  const city = typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
  if (city.length < 2 || city.length > 80 || !/^[\p{L}\p{M}\s.,'’()-]+$/u.test(city) ||
      !/\p{L}/u.test(city) || /\b(?:street|avenue|boulevard|apartment|suite|p\.?\s*o\.?\s*box)\b/iu.test(city))
    throw new Error("Enter a city and optional region, without a street address or postal code.");
  return city;
}

export function verifiedCityLocation(value) {
  if (!value || value.approximate !== true || value.provider !== "openstreetmap_nominatim" ||
      value.attribution !== "© OpenStreetMap contributors" ||
      typeof value.lat !== "number" || !Number.isFinite(value.lat) || Math.abs(value.lat) > 90 ||
      typeof value.lng !== "number" || !Number.isFinite(value.lng) || Math.abs(value.lng) > 180 ||
      Math.abs(Math.round(value.lat * 10) - value.lat * 10) > 1e-8 ||
      Math.abs(Math.round(value.lng * 10) - value.lng * 10) > 1e-8)
    throw new Error("The city location could not be verified.");
  const display = normalizeCityQuery(value.display);
  return { lat: value.lat, lng: value.lng, display, approximate: true,
    provider: "openstreetmap_nominatim", attribution: "© OpenStreetMap contributors" };
}
