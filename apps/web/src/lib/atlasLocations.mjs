// Atlas only accepts campaign-provided, explicitly approved broad locations.
// No inferred street, geocoding, payment, donation or demographic fields.
const coordinate = (value, max) =>
  value === null || value === undefined || value === "" ||
  !Number.isFinite(Number(value)) || Math.abs(Number(value)) > max ? null : Number(value);

export function mapAtlasCampaign(row = {}) {
  const approved = row.map_opt_in === true;
  return {
    id:String(row.id || ""),
    title:String(row.title || "Untitled campaign"),
    summary:String(row.summary || ""),
    category:String(row.category || "other"),
    status:String(row.status || "draft"),
    map_opt_in:approved,
    location:approved ? String(row.public_location_label || "").trim() : "",
    latitude:approved ? coordinate(row.map_latitude,90) : null,
    longitude:approved ? coordinate(row.map_longitude,180) : null,
  };
}
export function isApprovedAtlasLocation(row) {
  return row?.map_opt_in === true &&
    typeof row.location === "string" && row.location.trim().length > 1 &&
    coordinate(row.latitude,90) !== null && coordinate(row.longitude,180) !== null;
}
export function atlasLocationRows(campaigns = []) {
  const counts = new Map();
  for (const campaign of campaigns) {
    if (campaign.status !== "active" || !isApprovedAtlasLocation(campaign)) continue;
    const label=campaign.location.trim().replace(/\s+/gu," ");
    const key=label.toLocaleLowerCase("en-US");
    const entry=counts.get(key);
    if (entry) entry.value++;
    else counts.set(key,{name:label,value:1});
  }
  return [...counts.values()].sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name))
    .map(entry=>({...entry,label:entry.value+" campaigns"}));
}
export function atlasLocationSummary(campaigns = []) {
  const published=campaigns.filter(c=>c.status==="active");
  const mapped=published.filter(isApprovedAtlasLocation).length;
  return {published:published.length,mapped,unmapped:published.length-mapped,nonPublic:campaigns.length-published.length};
}

/**
 * Advisory client-side privacy screening for an organizer's public location label.
 * This is not geocoding or proof that a label is a safe/public place. The owner
 * must approve a broad city/region. These patterns reject obvious address/ZIP
 * strings without disallowing common locations such as "District 9, Seattle".
 */
export function isBroadPublicLocationLabel(value) {
  const label=String(value??"").trim();
  if(label.length<2||label.length>80)return false;
  if(/\b\d{5}(?:-\d{4})?\b/u.test(label))return false;
  if(/\b(?:p\.?\s*o\.?\s*box|apartment|apt\.?\s*#?\d+|suite\s*\d+|unit\s*#?\d+)\b/iu.test(label))return false;
  if(/^\s*\d{1,6}\s+(?:(?:[\p{L}'-]+|[NSEW])\s+){0,5}(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?|court|ct\.?|way|place|pl\.?)\b/iu.test(label))return false;
  return true;
}
