import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const app=readFileSync('src/App.jsx','utf8');
const routes=new Set([...app.matchAll(/\bpath="([^"]+)"/g)].map(x=>x[1]));
const routeMatches=(dest)=>{
  const p=dest.split(/[?#]/)[0].replace(/\/+$/,'')||'/';
  return [...routes].some(route=>{
    if(route==='*')return false;
    if(route===p)return true;
    const pattern='^'+route.replace(/:[a-zA-Z][\w]*/g,'[^/]+').replaceAll('/','\\/')+'$';
    return new RegExp(pattern).test(p);
  });
};
const walk=(dir)=>{
  const result=[];
  for(const item of readdirSync(dir,{withFileTypes:true})){
    const f=path.join(dir,item.name);
    if(item.isDirectory())result.push(...walk(f));
    else if(/\.(?:jsx?|tsx?)$/.test(item.name))result.push(f);
  }
  return result;
};
const files=walk('src');
const navigation=[],missingAssets=[];
const functions=new Set(readdirSync('base44/functions'));
const calls=[];
for(const file of files){
  const source=readFileSync(file,'utf8');
  const values=[
    ...source.matchAll(/\b(?:to|href)="(\/[^"\x24{}]*)"/g),
    ...source.matchAll(/\b(?:to|href)='(\/[^'\x24{}]*)'/g),
    ...source.matchAll(/\bnavigate\(\s*"(\/[^"\x24{}]*)"/g),
    ...source.matchAll(/\bnavigate\(\s*'(\/[^'\x24{}]*)'/g),
  ];
  for(const ref of values){
    const target=ref[1];
    if(!target.startsWith('//') && !routeMatches(target)){
      navigation.push({file,target});
    }
  }
  for(const match of source.matchAll(/(?:\bsrc|\bposter)=(?:"|')(?<url>\/[^"'?#]+)(?:"|')/g)){
    const loc=match.groups?.url;
    if(loc && !existsSync('public'+loc))missingAssets.push({file,loc});
  }
  for(const call of source.matchAll(/\bfunctions\.invoke\(\s*(?:"|')([^"']+)(?:"|')/g)){
    calls.push({file,name:call[1]});
  }
}
assert.deepEqual(navigation,[],'Broken internal static links: '+JSON.stringify(navigation.slice(0,15)));
assert.deepEqual(missingAssets,[],'Missing local static image/media: '+JSON.stringify(missingAssets.slice(0,15)));
assert.deepEqual(calls.filter(call=>!functions.has(call.name)),[],
  'Frontend refers to non-existent backend function');

const manifest=JSON.parse(readFileSync('public/manifest.json','utf8'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.scope,'/');
assert.ok(routeMatches(manifest.start_url),'Installable app start route must exist');
for(const icon of manifest.icons){
  assert.ok(existsSync('public'+icon.src),'Missing installable app icon '+icon.src);
}
assert.ok(existsSync('public/ifund-logo.jpg'),'The official IFund mark must be available locally');
const imageCode=readFileSync('src/components/ui/image.jsx','utf8');
assert.match(imageCode,/FALLBACK_IMAGE_URL = "\/ifund-logo\.jpg"/,
  'Broken remote uploads must resolve to the official IFund local image');
const styles=readFileSync('src/index.css','utf8');
assert.match(styles,/@import ".\/styles-ifund-studio\.css"/);
const shell=readFileSync('src/components/Layout.jsx','utf8');
assert.match(shell,/ifund-shell/);
assert.match(shell,/ifund-workspace-bar/);
console.log('PASS: '+routes.size+' routes, '+files.length+' frontend modules, '+calls.length+
  ' literal backend calls, internal links, local imagery and installable app icon references.');
