#!/usr/bin/env node
/**
 * IFund live frontend: read-only monitoring of published public pages.
 * Manual execution only. Never sign in, mutate records, send money, or deploy.
 */
import { writeFileSync, appendFileSync } from 'node:fs';

const PRIMARY = process.env.LIVE_SITE_URL || 'https://interplanetaryfund.com/';
const BASE44 = process.env.LIVE_BASE44_URL || 'https://interplanetaryfund.base44.app/';
const TIMEOUT_MS = 12000;
const outputPath = process.env.LIVE_AUDIT_REPORT || 'live-frontend-audit.json';
const entries = [];

function safeUrl(input, base) {
  const u = new URL(input, base);
  if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Unsupported URL protocol');
  if (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))
    throw new Error('Non-TLS URL refused');
  if (u.username || u.password) throw new Error('Credentials in URL are forbidden');
  return u;
}
async function getPage(input, base, sizeLimit = 500000) {
  let url = safeUrl(input, base);
  for (let n = 0; n < 5; n++) {
    const response = await fetch(url, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'IFund-Manual-Frontend-Audit/1.0', accept: 'text/html,application/json,*/*' }
    });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect missing location');
      url = safeUrl(location, url);
      continue;
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > sizeLimit) throw new Error('Response exceeds size limit');
    return {
      status: response.status,
      url: url.href,
      type: response.headers.get('content-type') || '',
      body: new TextDecoder().decode(bytes)
    };
  }
  throw new Error('Too many redirects');
}
function add(name, result, detail, url = '') {
  entries.push({ name, result, detail, url });
  console.log('[' + result + '] ' + name + ': ' + detail + (url ? ' (' + url + ')' : ''));
}
async function inspect(name, address, required) {
  try {
    const page = await getPage(address);
    const valid = page.status >= 200 && page.status < 400 &&
      /text\/html/i.test(page.type) &&
      /<html\b|<!doctype html/i.test(page.body) &&
      !/<title>\s*(?:error|not found|access denied)\s*<\/title>/i.test(page.body);
    add(name, valid ? 'PASS' : required ? 'FAIL' : 'WARN',
      'HTTP ' + page.status + '; ' + page.type, page.url);
    if (!valid || name !== 'Published website') return;
    const title = page.body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
    add('HTML document title', title ? 'PASS' : 'WARN', title || 'Missing title');
    const urls = [];
    for (const m of page.body.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi))
      urls.push(m[1]);
    for (const m of page.body.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi))
      urls.push(m[1]);
    const assets = [...new Set(urls)].filter(p => {
      try { return new URL(p, page.url).origin === new URL(page.url).origin; }
      catch { return false; }
    }).slice(0, 6);
    if (!assets.length) add('Frontend assets', 'WARN', 'No local script/style URLs detected');
    for (const asset of assets) {
      try {
        const r = await getPage(asset, page.url, 4000000);
        const ok = r.status === 200 && !/text\/html/i.test(r.type);
        add('Frontend asset', ok ? 'PASS' : 'FAIL',
          'HTTP ' + r.status + '; ' + r.type, r.url);
      } catch (error) {
        add('Frontend asset', 'FAIL', error.message, String(new URL(asset, page.url)));
      }
    }
  } catch (error) {
    add(name, required ? 'FAIL' : 'WARN', error.message, address);
  }
}
await inspect('Published website', PRIMARY, true);
await inspect('Published Base44 frontend', BASE44, true);
const totals = Object.fromEntries(['PASS','WARN','FAIL'].map(k =>
  [k, entries.filter(x => x.result === k).length]));
const report = {
  created_at: new Date().toISOString(),
  mode: 'manual-read-only',
  targets: { published_site: PRIMARY, base44_frontend: BASE44 },
  results: entries, totals
};
writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = entries.map(x => '| ' + x.name.replaceAll('|','/') + ' | ' +
    x.result + ' | ' + (x.detail + ' ' + x.url).replaceAll('|','/').replaceAll('\n',' ') +
    ' |').join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## IFund live frontend (manual, read-only)\n\n| Check | Result | Detail |\n|---|---|---|\n' + rows + '\n');
}
process.exitCode = totals.FAIL > 0 ? 1 : 0;
