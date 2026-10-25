import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root='host/workforce', agents='base44/agents', skills='.agents/skills';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const files=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]);
const list=[...files(agents),...files(skills).filter(p=>!p.includes('/node_modules/'))].sort();
const manifest={schema_version:1,mode:'staged-only',source:'Base44 main',activation:'disabled',agent_count:0,entries:[],unverified:['Live remote managed skill IDs and content','Live per-agent memory records and consent','Backend tool execution parity','Scheduled jobs and credentials','Cloudflare Worker runtime and production routing']};
for(const source of list){
  const raw=fs.readFileSync(source);
  const dest=path.join(root,'source',source);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,raw);
  manifest.entries.push({source,destination:dest,sha256:hash(raw),bytes:raw.length});
  if(source.startsWith(agents+'/')){
    const agent=JSON.parse(raw.toString('utf8'));
    manifest.agent_count++;
    if(!agent.name||!agent.instructions||!Array.isArray(agent.tool_configs))throw Error('Invalid agent '+source);
  }
}
fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Staged ${manifest.agent_count} exact agent definitions and ${manifest.entries.length-manifest.agent_count} skill files; no runtime changes.`);
