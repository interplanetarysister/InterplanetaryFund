import http from 'node:http';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import api from '../worker/index.js';

const canonical = 'https://ssibsfmtodgximseeqsv.supabase.co';
let key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
if (!key) {
  try {
    // This endpoint exposes only the same public identifier browsers already
    // receive. No service-role key or private Codespaces secret is fetched.
    const r = await fetch('https://fix-source-backed-preview.interplanetaryfund-source-preview.pages.dev/api/public-config', { signal:AbortSignal.timeout(10000) });
    const c = await r.json();
    if (r.ok && c.url === canonical && c.key?.startsWith('sb_publishable_')) key = c.key;
  } catch { /* An explicit environment binding remains supported. */ }
}
if (!key?.startsWith('sb_publishable_')) {
  throw Error('Set VITE_SUPABASE_PUBLISHABLE_KEY as a Codespaces secret, then restart. Only the public sb_publishable_ key is accepted.');
}
const env = { SUPABASE_URL:canonical, SUPABASE_PUBLISHABLE_KEY:key,
  MIGRATION_API_PREVIEW:'enabled', IFUND_GEOCODE_ENABLED:'enabled' };
const server = http.createServer(async (req,res) => {
  try {
    const request = new Request('http://127.0.0.1:8787'+req.url, {
      method:req.method, headers:req.headers,
      ...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{}),
    });
    const result = await api.fetch(request,env);
    res.writeHead(result.status,Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch { res.writeHead(500,{'content-type':'application/json'});res.end('{"error":"Development API request failed."}'); }
});
await new Promise((resolve,reject) => { server.once('error',reject);server.listen(8787,'127.0.0.1',resolve); });
const vite = spawn(process.execPath,[fileURLToPath(new URL('../apps/web/node_modules/vite/bin/vite.js',import.meta.url)),'--host','0.0.0.0','--port','5173','--strictPort'],{
  cwd:fileURLToPath(new URL('../apps/web',import.meta.url)), stdio:'inherit',
  env:{...process.env,VITE_SUPABASE_URL:canonical,VITE_SUPABASE_PUBLISHABLE_KEY:key},
});
console.log('IFund development: frontend 5173; API loopback 8787; canonical Supabase.');
const shutdown = () => { vite.kill('SIGTERM'); server.close(); };
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
vite.once('exit',code => { server.close();process.exitCode=code||0; });
