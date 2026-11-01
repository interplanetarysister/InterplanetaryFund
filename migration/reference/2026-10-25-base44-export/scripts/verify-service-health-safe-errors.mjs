import fs from 'node:fs';

const source = fs.readFileSync('src/components/platform/ServiceHealthPanel.jsx', 'utf8');
const required = [
  ['safe service error constant', source.includes('SAFE_SERVICE_ERROR')],
  ['raw exception not rendered', !source.includes('error: e.message')],
  ['server diagnostics retained', source.includes('console.error(`Service health check failed for ${s.name}:`, e)')],
  ['safe error rendered', source.includes('error: SAFE_SERVICE_ERROR')],
];

const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`Service-health safe-error verification failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Service-health safe-error verification passed.');
