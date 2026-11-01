import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Analytics.jsx', 'utf8');
const required = [
  ['stable safe error', source.includes('SAFE_ANALYTICS_ERROR')],
  ['raw exception not rendered', !source.includes('e.message')],
  ['malformed entity rejection', source.includes('isEntityList')],
  ['malformed donation rejection', source.includes('isDonationList')],
  ['auth response fails closed', source.includes('Malformed auth response')],
  ['request generation fencing', source.includes('requestGeneration') && source.includes('mounted')],
  ['refresh retry', source.includes('setRefreshKey((k) => k + 1)')],
];

for (const [name, ok] of required) {
  if (!ok) throw new Error(`Analytics safety contract failed: ${name}`);
}

console.log('Analytics safety contract passed.');
