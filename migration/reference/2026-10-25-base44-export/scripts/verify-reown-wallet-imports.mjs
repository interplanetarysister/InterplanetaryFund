// Guard against the Vite "Failed to resolve import @reown/appkit/react"
// regression. All wallet packages must be declared, lockfile-pinned and expose
// the exact framework-neutral entrypoint used by IFund's lazily loaded modal.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const source = readFileSync('src/lib/reownWallet.js', 'utf8');
const config = readFileSync('vite.config.js', 'utf8');
const required = [
  '@reown/appkit', '@reown/appkit/networks', '@reown/appkit-adapter-ethers',
  '@reown/appkit-adapter-solana', '@reown/appkit-adapter-bitcoin',
];
assert.match(source, /import\("@reown\/appkit"\)/);
assert.match(source, /import\("@reown\/appkit-adapter-solana"\)/);
assert.doesNotMatch(source, /@reown\/appkit\/react|@reown\/appkit-adapter-solana\/react/);
assert.doesNotMatch(config, /@reown\/appkit\/react|@reown\/appkit-adapter-solana\/react/);
assert.match(source, /if \(!projectId\)/);
assert.match(source, /modalPromise/);
assert.match(source, /await modal\.open/);

for (const specifier of required) {
  const packageName = specifier === '@reown/appkit/networks' ? '@reown/appkit' : specifier;
  assert.ok(manifest.dependencies?.[packageName], `Missing ${packageName} in package.json`);
  assert.ok(lock.packages?.['node_modules/' + packageName]?.version, `Missing ${packageName} from lockfile`);
  assert.ok(import.meta.resolve(specifier).startsWith('file:'), `Missing entrypoint ${specifier}`);
}
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const transformed = await server.transformRequest('/src/lib/reownWallet.js');
  assert.ok(transformed?.code, 'Vite must transform the wallet module');
  assert.doesNotMatch(transformed.code, /Failed to resolve import|@reown\/appkit\/react|@reown\/appkit-adapter-solana\/react/);
} finally {
  await server.close();
}
console.log('PASS: wallet dependency and lockfile integrity, Reown root exports and Vite development import transformation.');
