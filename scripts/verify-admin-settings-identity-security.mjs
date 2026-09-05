import fs from 'node:fs';

const source = fs.readFileSync('convex/security.ts', 'utf8');

const required = [
  ['authenticated identity required', /export async function requireIdentityPermission[\s\S]*await requireAuth\(ctx\)/],
  ['existing adminUsers lookup by email', /query\("adminUsers"\)[\s\S]*withIndex\("byEmail"/],
  ['settings permission enforced', /requireIdentityPermission\(ctx, "settings"\)/],
  ['public query does not accept admin PIN', /export const getAdminSetting = query\([\s\S]*args:\s*\{\s*key:\s*v\.string\(\)\s*\}/],
  ['credential-like keys denied', /\(pin\|password\|secret\|token\|credential\|private\.\?key\|api\.\?key\)/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(source)) throw new Error(`Admin settings identity security verification failed: ${label}`);
}

if (/getAdminSetting = query\([\s\S]*adminPin:\s*v\.string\(\)/.test(source)) {
  throw new Error('getAdminSetting must not accept an admin PIN as a public query argument');
}

console.log('Admin settings identity security verification passed.');
