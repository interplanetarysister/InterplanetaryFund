import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const path = new URL('../base44/shared/connectionVerification.ts', import.meta.url);
const js = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { verifyOAuthConnection } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);

const originalFetch = globalThis.fetch;
const permissions = (values) => ({ data: values.map((p) => ({ permission: p, status: 'granted' })) });
let grants = ['public_profile'];
let pages = [];
globalThis.fetch = async (url, opts = {}) => {
  assert.match(String(opts.headers?.Authorization || ''), /^Bearer fake-private-token$/);
  if (String(url).endsWith('/me/permissions')) return Response.json(permissions(grants));
  if (String(url).includes('/me/accounts')) return Response.json({ data: pages });
  throw new Error('Unexpected endpoint: ' + new URL(String(url)).pathname);
};

try {
  const oauth = { accessToken: 'fake-private-token' };
  await assert.rejects(
    () => verifyOAuthConnection('facebook', oauth),
    /facebook_page_publish_permission_required/,
    'Facebook identity login cannot be mistaken for Page posting approval',
  );
  grants = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
  pages = [{ id: '111', name: 'Read-only Page', tasks: ['ANALYZE'] }];
  await assert.rejects(
    () => verifyOAuthConnection('facebook', oauth),
    /facebook_page_publish_permission_required/,
    'Page posting needs a Page task that permits content creation',
  );
  pages = [
    { id: '111', name: 'Read-only Page', tasks: ['ANALYZE'] },
    { id: '222', name: 'Writable Page', tasks: ['CREATE_CONTENT'], access_token: 'never-return-this' },
  ];
  const result = await verifyOAuthConnection('facebook', oauth);
  assert.deepEqual(result, { pages: [{ id: '222', name: 'Writable Page' }] });
  assert.equal(JSON.stringify(result).includes('never-return-this'), false, 'Page token must not leave probe');
  console.log('PASS: Facebook Page posting permission, Page task and token-redaction checks.');
} finally {
  globalThis.fetch = originalFetch;
}
