import fs from 'node:fs';import path from 'node:path';
const m=JSON.parse(fs.readFileSync('host/workflows/manifest.json'));
const results=m.workflows.map(w=>{
 const missing=w.steps.filter(s=>s.function_name&&!fs.existsSync(path.join('base44/functions',s.function_name,'entry.ts'))).map(s=>s.function_name);
 const reasons=[];
 if(missing.length)reasons.push('missing source function: '+missing.join(','));
 if(w.name==='Campaign Sync on Update'&&w.events.join(',')==='create')reasons.push('trigger mismatch: named Update but listens to create');
 if(w.name==='Weekly Writing Psychology & Social Trends Training'&&w.cron_expression==='0 16 * * *')reasons.push('named Weekly but cron is daily; inspect function throttling');
 if(w.name==='Integration Health Check'&&/future scheduled/.test(JSON.parse(fs.readFileSync('base44/workflows/'+w.file)).description||''))reasons.push('source describes future workflow; activation not confirmed');
 if(w.name==='Volunteer Welcome Follow-up')reasons.push('pending delayed follow-ups require durable state reconciliation');
 if(w.trigger_type==='scheduled')reasons.push('live enabled state and last successful execution unknown');
 if(w.trigger_type==='entity')reasons.push('live entity event source and replay cursor unknown');
 reasons.push('independent Cloudflare function implementation and idempotency unverified');
 return {name:w.name,source_function_present:missing.length===0,eligible_for_activation:false,decision:'HOLD',reasons};
});
fs.writeFileSync('host/workflows/eligibility.json',JSON.stringify({checked_at:'2026-10-22',policy:'verify active need, current state, destination parity and duplicate protection before activation',results},null,2)+'\n');
console.log('Reviewed',results.length,'definitions; activation holds:',results.filter(x=>!x.eligible_for_activation).length);for(const x of results.filter(x=>x.reasons.some(r=>r.startsWith('trigger mismatch')||r.startsWith('named Weekly')||r.startsWith('source describes future'))))console.log(x.name,':',x.reasons.join('; '));
