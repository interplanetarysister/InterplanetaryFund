import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root='base44/workflows',out='host/workflows';fs.mkdirSync(out+'/source',{recursive:true});
const items=[];for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.jsonc')).sort()){
 const bytes=fs.readFileSync(path.join(root,name));const d=JSON.parse(bytes.toString());
 const target=path.join(out,'source',name);fs.writeFileSync(target,bytes);
 const t=d.trigger?.config||{};
 const steps=(d.definition?.do||[]).flatMap(s=>Object.values(s)).map(x=>({call:x.call||null,function_name:x.with?.function_name||null,wait:x.with?.duration||null}));
 items.push({name:d.name,file:name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),trigger_type:t.trigger_type,events:t.events||[],entity_name:t.entity_name||null,cron_expression:t.cron_expression||null,timezone:t.timezone||null,schedule_mode:t.schedule_mode||null,one_time_date:t.one_time_date||null,ends_type:t.ends_type||null,ends_on_date:t.ends_on_date||null,ends_after_count:t.ends_after_count||null,steps});
}
fs.writeFileSync(out+'/manifest.json',JSON.stringify({schema_version:1,execution:'disabled',source:'Base44 definitions; current enabled/running state not verified',workflows:items},null,2)+'\n');
console.log('Staged',items.length,'workflow definitions:',items.filter(x=>x.trigger_type==='scheduled').length,'scheduled and',items.filter(x=>x.trigger_type==='entity').length,'entity-triggered');
