import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const walk = dir => readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name))
  .flatMap(e => e.isDirectory() ? walk(resolve(dir,e.name)) : [resolve(dir,e.name)]);
function requireFile(path) {
  const target = resolve(output, '.' + path);
  if (!target.startsWith(output + '/') || !existsSync(target) || !statSync(target).isFile()) {
    throw Error('Preview artifact is missing referenced file: ' + path);
  }
  return target;
}
if (!existsSync(resolve(output, 'index.html'))) throw Error('Missing apps/web/dist/index.html. Build the source-backed frontend first.');
const files = walk(output).filter(p => !p.endsWith('/ifund-build.json'));
const js = files.filter(p => p.endsWith('.js')).map(p => readFileSync(p,'utf8')).join('\n');
if (!js.includes('Endless possibilities start with one question:') || !js.includes('/images/home-hero.jpg')) {
  throw Error('Wrong frontend bundle: original Home source and its local hero are absent.');
}
const html = readFileSync(resolve(output, 'index.html'),'utf8');
for (const [,path] of html.matchAll(/(?:src|href)=["'](\/[^"'#?]+)["']/g)) requireFile(path);
for (const file of files.filter(p=>p.endsWith('.css'))) {
  const css = readFileSync(file,'utf8');
  for (const [,raw] of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
    if (raw.startsWith('data:') || raw.startsWith('#')) continue;
    if (/^https?:|^\/\//i.test(raw)) throw Error('Design asset still loads from a remote CSS URL: ' + raw);
    const absolute = raw.startsWith('/') ? raw : '/' + relative(output,resolve(dirname(file),raw));
    requireFile(absolute.split(/[?#]/)[0]);
  }
}
for (const file of files.filter(p=>/\.(js|css)$/.test(p))) {
  if (/https:\/\/(?:[^/\s"']+\.)?base44\.(?:app|com)(?:\/|["'])/i.test(readFileSync(file,'utf8'))) {
    throw Error('Base44 runtime URL remains in built code: ' + relative(output,file));
  }
}
const sources = JSON.parse(readFileSync(resolve(root,'asset-sources.json'),'utf8'));
for (const asset of sources.assets) {
  if (hash(readFileSync(requireFile('/'+asset.path))) !== asset.sha256) throw Error('Source asset bytes differ: ' + asset.path);
}
for (const family of ['fraunces','inter','manrope']) requireFile('/fonts/'+family+'-OFL.txt');
requireFile('/_worker.js');
const routing = JSON.parse(readFileSync(requireFile('/_routes.json'),'utf8'));
if (!routing.include.includes('/api/*')) throw Error('Independent API routing is absent.');
const manifest = JSON.parse(readFileSync(requireFile('/manifest.json'),'utf8'));
for (const icon of manifest.icons || []) requireFile(icon.src);
const sourceFiles = [...walk(resolve(root,'src')), ...walk(resolve(root,'server')), ...walk(resolve(root,'../../worker')), resolve(root,'index.html'), resolve(root,'tailwind.config.js')];
const gitRoot = resolve(root,'../..');
const commit = process.env.CF_PAGES_COMMIT_SHA || execFileSync('git',['-C',gitRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty = execFileSync('git',['-C',gitRoot,'status','--porcelain','--','apps/web'],{encoding:'utf8'}).trim().length > 0;
const proof = {
  frontend_root:'apps/web', reference_repository:sources.reference_repository,
  reference_commit:sources.reference_commit, source_commit:commit, working_tree_dirty:dirty,
  full_platform_parity_verified:false,
  evidence_scope:'Build/code/assets only. Remaining placeholder routes and provider/user journeys are not certified.',
  source_files:sourceFiles.map(p=>({path:relative(root,p),sha256:hash(readFileSync(p))})),
  artifact_files:files.map(p=>({path:relative(output,p),sha256:hash(readFileSync(p)),bytes:statSync(p).size})),
};
writeFileSync(resolve(output,'ifund-build.json'),JSON.stringify(proof,null,2)+'\n');
console.log('Verified apps/web artifact: '+files.length+' files; original hero, 16 local font files, CSS references and icons present.');
