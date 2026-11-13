/** Free, deterministic FORGE trend comparison. No automated posting/alerts. */
const count=value=>{
  if(value===null||value===undefined||value===""||typeof value==="boolean")return null;
  if(typeof value==="string"&&!/^(0|[1-9]\d*)$/.test(value))return null;
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>=0?n:null;
};
/**
 * Compare recent seven days with the preceding 23 days inside the 30-day window.
 * Returning unavailable is safer than treating unknown counts as zero.
 */
export function evaluateGrowthTrend(last7,last30,{label="activity",significanceThreshold=7}={}) {
  const recent=count(last7),monthly=count(last30);
  if(recent===null||monthly===null||recent>monthly)return {status:"unavailable",message:"Verified activity trend unavailable."};
  const preceding=monthly-recent;
  if(preceding===0&&recent===0)return {status:"quiet",message:`No recorded ${label} in the past 30 days. This does not verify that outreach was attempted.`};
  if(preceding<significanceThreshold)return {status:"insufficient",message:"Not enough prior activity for a reliable trend comparison."};
  const priorDaily=preceding/23,recentDaily=recent/7;
  const ratio=recentDaily/priorDaily;
  if(ratio<=0.5)return {status:"declining",ratio,previousCount:preceding,
    message:`Recorded ${label} per day are at least 50% lower in the last 7 days than the preceding 23 days. Review campaign messaging before changing outreach.`};
  if(ratio>=1.5)return {status:"growing",ratio,previousCount:preceding,
    message:`Recorded ${label} per day are at least 50% higher in the last 7 days than the preceding 23 days.`};
  return {status:"stable",ratio,previousCount:preceding,
    message:`Recorded ${label} activity is within ±50% of its preceding 23-day daily average.`};
}
