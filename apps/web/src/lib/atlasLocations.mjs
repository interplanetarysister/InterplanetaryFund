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
