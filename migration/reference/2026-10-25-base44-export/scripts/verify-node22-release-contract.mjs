import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

export function verifyReleaseContract(root=process.cwd()) {
  const errors=[];
  const read=(p)=>{ try{return readFileSync(join(root,p),'utf8')}catch{errors.push('missing:'+p);return ''} };
  const json=(p)=>{try{return JSON.parse(read(p))}catch{errors.push('malformed:'+p);return null}};
  const pkg=json('package.json');
  if(pkg?.engines?.node!=='>=24.12.0')errors.push('Node engine must allow Node 24.12.0 or newer');
  if(read('.node-version').trim()!=='24')errors.push('.node-version must select tested Node 24');
  if(read('.nvmrc').trim()!=='24')errors.push('.nvmrc must select tested Node 24');
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<24 || (major===24 && minor<12))errors.push('Node 24.12.0 or newer required');
  const lock=json('package-lock.json');
  if(lock?.packages?.['']?.engines?.node!=='>=24.12.0')errors.push('Lockfile must declare Node >=24.12.0');
  let files=[];
  try{files=readdirSync(join(root,'.github/workflows')).filter(p=>/\.ya?ml$/.test(p))}
  catch{errors.push('missing:.github/workflows')}
  let found=0;
  for(const file of files){
    const p=join('.github/workflows',file);
    let workflow;
    try{workflow=yaml.load(read(p))}catch{errors.push('malformed:'+p);continue}
    for(const job of Object.values(workflow?.jobs||{})){
      for(const step of job?.steps||[]){
        if(!/^actions\/setup-node@/i.test(step?.uses||''))continue;
        found++;
        const version=String(step.with?.['node-version']||'').trim();
        if(version!=='24')errors.push(p+' must use tested Node 24 for setup-node');
      }
    }
  }
  if(!found)errors.push('No Node setup configured');
  return errors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const errors=verifyReleaseContract();
 if(errors.length){for(const error of errors)console.error(error);process.exitCode=1}
 else console.log('PASS: Node >=24.12.0 with tested Node 24 build selectors');
}
