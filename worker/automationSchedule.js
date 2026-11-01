import { WORKFLOWS } from "./automationRegistry.js";
const acceptableTimezones = new Set(["UTC", "America/Los_Angeles"]);
function matchesField(expression, actual, first, last) {
  return expression.split(",").some((piece) => {
    if (piece === "*") return true;
    const [range, every] = piece.split("/");
    const step = every === undefined ? 1 : Number(every);
    if (!Number.isSafeInteger(step) || step < 1) return false;
    if (range === "*") return (actual - first) % step === 0;
    const pair = range.split("-").map(Number);
    if (pair.length === 2 && pair.every(Number.isInteger)) {
      return pair[0] >= first && pair[1] <= last && actual >= pair[0] &&
        actual <= pair[1] && (actual - pair[0]) % step === 0;
    }
    return pair.length === 1 && Number.isInteger(pair[0]) && pair[0] >= first &&
      pair[0] <= last && actual === pair[0];
  });
}
function localParts(at, timeZone) {
  if (!acceptableTimezones.has(timeZone)) throw new TypeError("Unsupported schedule timezone");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year:"numeric", month:"2-digit", day:"2-digit",
    weekday:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(new Date(at));
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {minute:Number(p.minute),hour:Number(p.hour),day:Number(p.day),
    month:Number(p.month),dayOfWeek:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday)};
}
export function cronMatches(cron, timeZone, timestamp) {
  if (!Number.isFinite(timestamp)) return false;
  const fields = cron.split(" ");
  if (fields.length !== 5) return false;
  const p=localParts(timestamp,timeZone);
  return fields.every((e,i)=>matchesField(e,[p.minute,p.hour,p.day,p.month,p.dayOfWeek][i],
    [0,0,1,1,0][i],[59,23,31,12,6][i]));
}
export function scheduledWorkflowsAt(timestamp) {
  return WORKFLOWS.filter(w=>w.kind==="scheduled" &&
    // The original "weekly" workflow has a daily cron; hold until the
    // weekly deduplication policy and previous execution cursor are migrated.
    w.id!=="Weekly Writing Psychology & Social Trends Training" &&
    cronMatches(w.cron,w.timezone,timestamp));
}
export function stableWorkflowInstanceId(id,timestamp,recordId="") {
  if (!Number.isFinite(timestamp)) throw new TypeError("Invalid scheduled time");
  const slug=id.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  // No unbounded user strings in Cloudflare's instance ID.
  const record=recordId ? "-"+String(recordId).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,36) : "";
  return ("ifund-"+slug+"-"+new Date(timestamp).toISOString().replace(/\D/g,"").slice(0,12)+record).slice(0,100);
}
