// Shared verified-catalog freshness policy. Directory links are not confirmed offers.
export const OPEN_VERIFICATION_MAX_AGE_DAYS=30;
export const PROGRAM_VERIFICATION_MAX_AGE_DAYS=180;
const DAY=86400000;
export function currentVerifiedOpportunity(row,{now=Date.now(),requireSourceSystem=true}={}){
 if(!row||!Number.isFinite(now)||!["open","program"].includes(row.status))return false;
 if(requireSourceSystem&&row.source_system!=="ifund_external_verified_v1")return false;
 const raw=row.official_url??row.url;
 try{const url=new URL(raw);if(url.protocol!=="https:"||url.username||url.password)return false;}
 catch{return false;}
 const checked=Date.parse(row.verified_at??"");
 const maxDays=row.status==="open"?OPEN_VERIFICATION_MAX_AGE_DAYS:PROGRAM_VERIFICATION_MAX_AGE_DAYS;
 if(!Number.isFinite(checked)||checked>now||now-checked>maxDays*DAY)return false;
 // Exact provider timestamps take precedence; also respect legacy date-only limits.
 if(row.deadline_at!=null&&row.deadline_at!==""){
  const deadline=Date.parse(row.deadline_at);
  if(!Number.isFinite(deadline)||deadline<=now)return false;
 }
 if(row.deadline_date!=null&&row.deadline_date!==""){
  if(typeof row.deadline_date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(row.deadline_date))return false;
  const date=Date.parse(row.deadline_date+"T00:00:00Z");
  if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==row.deadline_date||
     row.deadline_date<new Date(now).toISOString().slice(0,10))return false;
 }
 return true;
}
export function opportunityDeadlineLabel(row){
 if(row?.deadline_at)return "Deadline: "+new Date(row.deadline_at).toISOString().replace("T"," ").slice(0,16)+" UTC";
 if(row?.deadline_date)return "Deadline date: "+row.deadline_date+" (provider timezone unconfirmed)";
 return "Deadline unknown; verify with the official provider.";
}
