import fs from 'node:fs';
import crypto from 'node:crypto';

const origins = process.env.IFUND_SMOKE_URL ? [process.env.IFUND_SMOKE_URL] : [
  'https://interplanetaryfund.com',
  'https://www.interplanetaryfund.com',
  'https://interplanetary-fund2.interplanetary-fund.workers.dev',
  'https://interplanetaryfund.base44.app',
];
const localHtml = fs.readFileSync('dist/index.html', 'utf8');
const entry = html => html.match(/(?:src=["'])(\/assets\/index-[\w-]+\.js)(?:["'])/)?.[1] || '';
// Hosts may reorder HTML attributes (e.g. href before rel); inspect tags, not attribute order.
const linkAttributes = tag => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
    .map(match => [match[1].toLowerCase(), match[2] ?? match[3]])
);
const criticalAssets = html => {
  const main = entry(html);
  if (!main) throw Error('Release is missing its JS entry bundle');
  const assets = [{ type: 'entry', path: main }];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const { rel, href } = linkAttributes(tag[0]);
    if (!['stylesheet', 'modulepreload'].includes(rel)) continue;
    if (!/^\/assets\/[^\s"'?#]+$/.test(href || '')) continue;
    assets.push({ type: rel, path: href });
  }
  if (!assets.some(asset => asset.type === 'stylesheet')) throw Error('Release is missing its stylesheet');
  return assets;
};
// Offline regression: both Vite and hosted HTML attribute orders must yield the same assets.
if (process.env.IFUND_PARITY_PARSER_SELFTEST === '1') {
  const vite = '<script src="/assets/index-TEST.js"></script><link rel="modulepreload" href="/assets/vendor-TEST.js"><link rel="stylesheet" href="/assets/style-TEST.css">';
  const hosted = '<script crossorigin="" src="/assets/index-TEST.js" type="module"></script><link href="/assets/vendor-TEST.js" rel="modulepreload"/><link crossorigin="" href="/assets/style-TEST.css" rel="stylesheet"/>';
  const expected = criticalAssets(vite);
  if (JSON.stringify(expected) !== JSON.stringify(criticalAssets(hosted)) || expected.length !== 3) {
    throw Error('HTML asset parser failed reordered-attribute regression');
  }
  console.log('PASS: Vite and hosted asset attributes parsed identically');
  process.exit(0);
}
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const localAssets = criticalAssets(localHtml).map(asset => ({
  ...asset, hash: hash(fs.readFileSync('dist' + asset.path)),
}));
const localPath = localAssets[0].path;
const localHash = localAssets[0].hash;
const results=[];
for (const origin of origins) {
  try {
    const site=origin.replace(/\/$/,'');
    const response=await fetch(site+'/?ifund_build_check='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTML returned '+response.status);
    const liveAssets = criticalAssets(await response.text());
    const livePath = liveAssets[0].path;
    const compared = [];
    for (let i = 0; i < Math.max(localAssets.length, liveAssets.length); i++) {
      const local = localAssets[i];
      const remote = liveAssets[i];
      if (!local || !remote || local.type !== remote.type) {
        compared.push({ type: local?.type || remote?.type, matched: false, reason: 'Asset list differs' });
        continue;
      }
      const liveResponse = await fetch(new URL(remote.path, site), { signal: AbortSignal.timeout(15000) });
      if (!liveResponse.ok) {
        compared.push({ type: remote.type, path: remote.path, matched: false, reason: 'HTTP ' + liveResponse.status });
        continue;
      }
      const liveHash = hash(Buffer.from(await liveResponse.arrayBuffer()));
      compared.push({ type: remote.type, path: remote.path, matched: local.hash === liveHash });
    }
    results.push({ origin: site, livePath, assetsChecked: compared.length,
      mismatches: compared.filter(asset => !asset.matched), matched: compared.every(asset => asset.matched) });
  } catch(error) {
    results.push({origin,error:String(error.message||error),matched:false});
  }
}
console.log(JSON.stringify({localPath,localHash,results},null,2));
if(results.some(result=>!result.matched))process.exitCode=1;
