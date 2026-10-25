import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { init, parse } from 'es-module-lexer';

await init;
const dir=path.resolve('dist/assets');
const files=fs.readdirSync(dir).filter(file=>file.endsWith('.js'));
const all=new Set(files);
const graph=new Map();
for (const file of files){
  const source=fs.readFileSync(path.join(dir,file),'utf8');
  const [imports]=parse(source);
  const dependencies=imports.filter(item=>item.d===-1 && item.n?.startsWith('./'))
    .map(item=>item.n.slice(2)).filter(item=>all.has(item));
  graph.set(file,dependencies);
}
const visited=new Set(),active=[],found=[];
function traverse(file){
  const index=active.indexOf(file);
  if(index>=0){found.push(active.slice(index).concat([file]));return;}
  if(visited.has(file))return;
  active.push(file);
  for(const dependency of graph.get(file)||[])traverse(dependency);
  active.pop();
  visited.add(file);
}
for(const file of files)traverse(file);
assert.deepEqual(found,[],'Circular static JavaScript imports would break production initialization: '+JSON.stringify(found.slice(0,4)));
const react=files.find(f=>/^react-runtime-.*\.js$/.test(f));
const viem=files.find(f=>/^viem-runtime-.*\.js$/.test(f));
assert.ok(react&&viem,'Framework and viem must each have a coherent runtime chunk');
console.log('PASS: '+files.length+' JavaScript chunks have no circular static imports.');
