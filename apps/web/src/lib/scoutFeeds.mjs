// SCOUT's safe, public research inputs. NOT sponsor offer catalogs.
export const SCOUT_PUBLIC_FEEDS=Object.freeze([
 Object.freeze({id:"grants-gov",name:"Grants.gov",url:"https://www.grants.gov/rss/GG_NewOppByAgency.xml",domain:"grants.gov",kind:"grants"}),
 Object.freeze({id:"grants-category",name:"Grants.gov (category)",url:"https://www.grants.gov/rss/GG_NewOppByCategory.xml",domain:"grants.gov",kind:"grants"})
]);
function entityDecode(text) {
 return String(text||"").replace(/&(?:amp|lt|gt|quot|apos|#39|#x[0-9a-f]+|#\d+);/gi,m=>{
 const map={"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&#39;":"'"};
 const lower=m.toLowerCase();
 if(Object.hasOwn(map,lower))return map[lower];
 if(/^&#x/i.test(m)){const v=Number.parseInt(m.slice(3,-1),16);return Number.isInteger(v)&&v>0&&v<=0x10ffff?String.fromCodePoint(v):"";}
 if(/^&#/i.test(m)){const v=Number.parseInt(m.slice(2,-1),10);return Number.isInteger(v)&&v>0&&v<=0x10ffff?String.fromCodePoint(v):"";}
 return m;
 });
}
const xmlField=(xml,name)=>{const match=xml.match(new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i"));return match?.[1]||"";};
const clean=value=>entityDecode(String(value||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());
export function scoutSafeLink(value,domain){
 try {const u=new URL(String(value).trim());return u.protocol==="https:"&&!u.username&&!u.password&&
   (u.hostname===domain||u.hostname.endsWith("."+domain))&&u.hash.length<=200; }
 catch {return false;}
}
export function scoutParsePublicRss(xml,source,{limit=20,now=Date.now()}={}){
 if(typeof xml!=="string"||xml.length>600000||!xml.includes("<rss")&&!xml.includes("<feed"))return [];
 const cap=Math.max(1,Math.min(50,limit));
 const items=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,cap*3);
 return items.map(([,body])=>{
  const title=clean(xmlField(body,"title")).slice(0,160);
  const url=clean(xmlField(body,"link")).slice(0,600);
  const description=clean(xmlField(body,"description")).slice(0,550);
  const rawDate=clean(xmlField(body,"pubDate")||xmlField(body,"dc:date"));
  const date=Date.parse(rawDate);
  return {source_id:source.id,source_name:source.name,source_url:source.url,title,url,
   summary:description,published_at:Number.isFinite(date)&&date<=now?new Date(date).toISOString():null,
   status:"unreviewed_official_feed",eligibility_verified:false,provider_partnership_verified:false,
   reward_verified:false};
 }).filter(x=>x.title.length>=5&&scoutSafeLink(x.url,source.domain)).slice(0,cap);
}
export function scoutFilterLeads(items,q=""){
 const text=String(q||"").normalize("NFKC").trim().toLowerCase().slice(0,100);
 return !text?items:items.filter(row=>(row.title+" "+row.summary).toLowerCase().includes(text));
}
