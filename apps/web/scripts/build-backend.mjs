import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
await build({
  entryPoints:[fileURLToPath(new URL('server/worker.js',root))],
  outfile:fileURLToPath(new URL('dist/_worker.js',root)),
  bundle:true, format:'esm', platform:'browser', target:'es2022',
});
writeFileSync(new URL('dist/_routes.json',root),JSON.stringify({
  version:1, include:['/api/*','/functions/geocodeCity'], exclude:[],
},null,2)+'\n');
console.log('Bundled independent Pages API: campaigns, posts, owner account and geocoding.');
