import fs from 'node:fs';

const source = fs.readFileSync('src/pages/GlobalGlobe.jsx', 'utf8');
const required = [
  ['stable safe error', source.includes('SAFE_GLOBE_ERROR')],
  ['no direct thrown message access', !source.includes('e.message') && !source.includes('err.message')],
  ['array response validation', source.includes('Array.isArray(result)')],
  ['bounded response size', source.includes('MAX_CAMPAIGNS')],
  ['retry re-runs request', source.includes('setRefreshKey((value) => value + 1)')],
  ['mounted fencing', source.includes('mountedRef.current')],
  ['request generation fencing', source.includes('requestRef.current === requestId')],
  ['finite coordinate validation', source.includes('Number.isFinite(c.location_lat)') && source.includes('Number.isFinite(c.location_lng)')],
];
const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`GlobalGlobe verifier failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`GlobalGlobe verifier passed (${required.length} checks).`);
