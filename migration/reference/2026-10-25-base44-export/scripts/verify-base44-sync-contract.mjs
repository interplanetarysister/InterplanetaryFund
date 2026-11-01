import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const syncSource = read('base44/functions/syncGitHub/entry.ts');
const runbook = read('docs/deferred-base44-workflows.md');
const pkg = JSON.parse(read('package.json'));
const nodeVersion = read('.node-version').trim();
const nvmrc = read('.nvmrc').trim();
const quality = read('.github/workflows/quality-gates.yml');

assert.equal(nodeVersion, '24', '.node-version must use tested Node 24');
assert.equal(nvmrc, '24', '.nvmrc must use tested Node 24');
assert.equal(pkg.engines?.node, '>=24.12.0', 'package engine must satisfy Firebase 13 Node minimum');
assert.match(quality, /node-version:\s*['\"]24['\"]/, 'quality gates must use tested Node 24');


function stripJsonComments(source) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function stripTrailingJsonCommas(source) {
  let output = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ',') {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] || '')) lookahead += 1;
      if (source[lookahead] === '}' || source[lookahead] === ']') continue;
    }
    output += char;
  }
  return output;
}

function parseJsonc(source, name) {
  try {
    return JSON.parse(stripTrailingJsonCommas(stripJsonComments(source)));
  } catch (error) {
    throw new Error(name + ' is not valid JSONC: ' + error.message);
  }
}

function workflowInvokesSyncGitHub(value) {
  if (Array.isArray(value)) return value.some(workflowInvokesSyncGitHub);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key.replace(/[_-]/g, '').toLowerCase();
    if (
      typeof child === 'string' &&
      ['functionname', 'function', 'call'].includes(normalizedKey) &&
      child === 'syncGitHub'
    ) return true;
    return workflowInvokesSyncGitHub(child);
  });
}

function assertNoWorkflowInvocation(entries) {
  for (const [name, source] of entries) {
    assert.equal(
      workflowInvokesSyncGitHub(parseJsonc(source, name)),
      false,
      name + ' must not invoke syncGitHub until workflow identity is server-verifiable'
    );
  }
}

assert.throws(
  () => assertNoWorkflowInvocation([
    [
      'Renamed Scheduled Check.jsonc',
      '{\n// alternate filename and escaped function value\n"definition":{"do":[{"call":"invoke_backend_function","with":{"function_name":"sync\\u0047itHub",},},]},\n}'
    ]
  ]),
  /Renamed Scheduled Check\.jsonc must not invoke syncGitHub/,
  'escaped function names and alternate workflow filenames must not bypass the gate'
);

const workflowDir = new URL('base44/workflows/', root);
const workflowEntries = readdirSync(workflowDir)
  .filter((name) => name.endsWith('.jsonc'))
  .map((name) => [name, read('base44/workflows/' + name)]);
assertNoWorkflowInvocation(workflowEntries);

function scriptKindFor(fileName) {
  return /\.(?:jsx|tsx)$/i.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return null;
}

function analyzeSource(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName)
  );
  const bindings = new Map();

  function collectBindings(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      bindings.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, collectBindings);
  }
  collectBindings(sourceFile);

  function resolveString(node, allowPartial = false, seen = new Set()) {
    if (!node) return null;
    if (ts.isParenthesizedExpression(node)) return resolveString(node.expression, allowPartial, seen);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      return resolveString(node.expression, allowPartial, seen);
    }
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text;
      for (const span of node.templateSpans) {
        const resolved = resolveString(span.expression, allowPartial, new Set(seen));
        if (resolved === null && !allowPartial) return null;
        value += resolved === null ? '[dynamic]' : resolved;
        value += span.literal.text;
      }
      return value;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = resolveString(node.left, allowPartial, new Set(seen));
      const right = resolveString(node.right, allowPartial, new Set(seen));
      if (!allowPartial && (left === null || right === null)) return null;
      return (left === null ? '[dynamic]' : left) + (right === null ? '[dynamic]' : right);
    }
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      const initializer = bindings.get(node.text);
      if (seen.has(initializer)) return null;
      const nextSeen = new Set(seen);
      nextSeen.add(initializer);
      return resolveString(initializer, allowPartial, nextSeen);
    }
    return null;
  }

  function resolveStringOptions(node, seen = new Set()) {
    if (!node) return [];
    if (ts.isParenthesizedExpression(node)) return resolveStringOptions(node.expression, seen);
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      return resolveStringOptions(node.expression, seen);
    }
    if (ts.isConditionalExpression(node)) {
      return [
        ...resolveStringOptions(node.whenTrue, new Set(seen)),
        ...resolveStringOptions(node.whenFalse, new Set(seen)),
      ];
    }
    if (ts.isIdentifier(node) && bindings.has(node.text)) {
      const initializer = bindings.get(node.text);
      if (seen.has(initializer)) return [];
      const nextSeen = new Set(seen);
      nextSeen.add(initializer);
      return resolveStringOptions(initializer, nextSeen);
    }
    const value = resolveString(node, false, new Set(seen));
    return value === null ? [] : [value];
  }

  function isInvokeExpression(expression) {
    if (ts.isIdentifier(expression)) return expression.text === 'invoke';
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text === 'invoke';
    if (ts.isElementAccessExpression(expression)) {
      return resolveString(expression.argumentExpression) === 'invoke';
    }
    return false;
  }

  const invokedFunctions = [];
  const humanText = [];
  const auditActions = [];
  const humanFields = new Set(['title', 'body', 'description', 'error', 'reason', 'detail', 'message']);
  const humanAttributes = new Set(['title', 'aria-label', 'alt', 'placeholder']);

  function addHuman(node) {
    const value = resolveString(node, true);
    if (value !== null && value.trim()) humanText.push(value.trim());
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (isInvokeExpression(node.expression) && node.arguments[0]) {
        const target = resolveString(node.arguments[0]);
        if (target !== null) invokedFunctions.push(target);
      }
      const calledName = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : null;
      if (calledName === 'logAudit' && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
        for (const property of node.arguments[1].properties) {
          if (ts.isPropertyAssignment(property) && propertyName(property.name) === 'action') {
            auditActions.push(...resolveStringOptions(property.initializer));
          }
        }
      }
      if (
        calledName === 'toast' ||
        calledName === 'error' ||
        calledName === 'warn' ||
        calledName === 'log'
      ) {
        for (const argument of node.arguments) {
          if (!ts.isObjectLiteralExpression(argument)) addHuman(argument);
        }
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Error') {
      for (const argument of node.arguments || []) addHuman(argument);
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);
      if (name && humanFields.has(name)) addHuman(node.initializer);
    }

    if (ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, ' ').trim();
      if (value) humanText.push(value);
    }

    if (ts.isJsxExpression(node) && node.expression) addHuman(node.expression);

    if (ts.isJsxAttribute(node) && humanAttributes.has(node.name.text)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) humanText.push(node.initializer.text);
      else if (node.initializer && ts.isJsxExpression(node.initializer)) addHuman(node.initializer.expression);
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return { invokedFunctions, humanText, auditActions };
}

const templateQuote = String.fromCharCode(96);
const invocationFixture =
  'const fn = ' + templateQuote + 'syncGitHub' + templateQuote + '; invoke(fn);';
assert.ok(
  analyzeSource(invocationFixture, 'computed-invocation.ts').invokedFunctions.includes('syncGitHub'),
  'const template-literal references passed to invoke must be discovered'
);

const concatenatedInvocationFixture =
  'const prefix = "sync"; const suffix = "\\u0047itHub"; const fn = prefix + suffix; base44.functions.invoke(fn, {});';
assert.ok(
  analyzeSource(concatenatedInvocationFixture, 'concatenated-invocation.ts').invokedFunctions.includes('syncGitHub'),
  'escaped and concatenated const references passed to functions.invoke must be discovered'
);

function isExplicitlyDeferred(text) {
  return /\b(?:not implemented|does not|do not|never|deferred|intentionally absent|remains exclusively|only through|cannot|no source (?:transfer|movement))\b/i.test(text);
}

function isNativeCapabilityScope(text) {
  return /\bBase44(?:'s)? native\b/i.test(text) &&
    /\b(?:source application|source synchronization|synchronization control)\b/i.test(text);
}

function isFalseSourceMovementClaim(text) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized || isExplicitlyDeferred(normalized) || isNativeCapabilityScope(normalized)) return false;

  const hasContext = /\b(?:GitHub|Base44|source|repository)\b/i.test(normalized);
  const hasMovementTerm =
    /\b(?:sync(?:ed|ing)?|synchroniz(?:e|es|ed|ing|ation)|transfer(?:red|ring)?|import(?:ed|ing)?|export(?:ed|ing)?|push(?:ed|ing)?|pull(?:ed|ing)?)\b/i.test(normalized);
  const hasOutcome =
    /\b(?:success(?:ful|fully)?|succeed(?:ed)?|complete(?:d)?|fail(?:ed|ure)?|error|issue|unable|unavailable|skipp(?:ed)?)\b|could not/i.test(normalized);
  const assertsMovement =
    /\b(?:moves?|moved|sends?|sent|creates?|created|applies?|applied|fast[- ]?forwards?|transfers?|transferred|imports?|imported|exports?|exported|pushes?|pushed|pulls?|pulled)\b/i.test(normalized);
  const imperative =
    /\b(?:sync|synchronize|transfer|import|export|push|pull)\s+(?:with\s+|to\s+|from\s+)?(?:GitHub|Base44|source|repository)\b/i.test(normalized);

  return hasContext && hasMovementTerm && (hasOutcome || assertsMovement || imperative);
}

function assertNoFalseSourceMovementClaims(texts, path) {
  const offending = texts.filter(isFalseSourceMovementClaim);
  assert.deepEqual(
    offending,
    [],
    path + ' contains false GitHub/Base44 source-movement claim(s): ' + offending.join(' | ')
  );
}

const concatenatedToastFixture =
  "const a='GitHub synchronization'; const b=' completed'; toast({title:a+b});";
assert.throws(
  () => {
    const analysis = analyzeSource(concatenatedToastFixture, 'concatenated-toast.tsx');
    assertNoFalseSourceMovementClaims(analysis.humanText, 'concatenated-toast.tsx');
  },
  /false GitHub\/Base44 source-movement claim/,
  'const-concatenated toast titles must be evaluated semantically'
);

assert.throws(
  () => assertNoFalseSourceMovementClaims(
    ['GitHub source transfer completed'],
    'source-transfer-fixture'
  ),
  /false GitHub\/Base44 source-movement claim/,
  'equivalent source-transfer completion claims must fail'
);

for (const fixture of [
  'Sync GitHub',
  'GitHub sync succeeded.',
  'GitHub source import completed.',
  'GitHub export failed.',
  'Pull fast-forwards Base44 to match GitHub.',
  'Push sends Base44 commits to GitHub.'
]) {
  assert.throws(
    () => assertNoFalseSourceMovementClaims([fixture], 'movement-negative-fixture'),
    /false GitHub\/Base44 source-movement claim/,
    'negative fixture must fail: ' + fixture
  );
}

assertNoFalseSourceMovementClaims(
  [
    'syncGitHub',
    'github_sync',
    'GitHub connection verification completed.',
    'These checks do not move files or create commits.',
    'GitHub source synchronization is deferred and not implemented here.',
    'Repository changes are applied only through Base44 native source synchronization.'
  ],
  'truthful-positive-fixtures'
);


function assertTruthfulAuditActions(actions, path) {
  assert.ok(actions.length > 0, path + ' must expose a statically verifiable AuditLog action');
  for (const action of actions) {
    assert.ok(
      action === 'github_connection_verified' ||
      action === 'github_connection_verification_failed',
      path + ' contains false or unknown GitHub audit action: ' + action
    );
  }
}

const falseAuditFixture =
  "async function syncGitHub() { await logAudit(base44, { action: 'github_sync' }); }";
assert.throws(
  () => assertTruthfulAuditActions(
    analyzeSource(falseAuditFixture, 'syncGitHub-audit-negative.ts').auditActions,
    'syncGitHub-audit-negative.ts'
  ),
  /false or unknown GitHub audit action: github_sync/,
  "AuditLog action 'github_sync' must fail even though the function identifier syncGitHub is allowed"
);

const identifierOnlyAnalysis = analyzeSource(
  'export default function syncGitHub() { return "syncGitHub"; }',
  'syncGitHub-identifier-positive.ts'
);
assert.deepEqual(
  identifierOnlyAnalysis.auditActions,
  [],
  'the syncGitHub function/code identifier must not be misclassified as an audit action'
);
assertNoFalseSourceMovementClaims(
  identifierOnlyAnalysis.humanText,
  'syncGitHub-identifier-positive.ts'
);

const syncAnalysis = analyzeSource(syncSource, 'base44/functions/syncGitHub/entry.ts');
assert.match(syncSource, /const REPO = 'interplanetarysister\/interplanetary-fund2'/);
assert.match(syncSource, /const BRANCH = 'main'/);
assert.match(syncSource, /if \(!user\) return Response\.json\(\{ error: 'Unauthorized' \}/);
assert.match(syncSource, /user\.role !== 'admin'/);
assert.doesNotMatch(syncSource, /initiator_type|isWorkflow/,
  'caller-supplied workflow labels must never bypass authentication');
assert.match(syncSource, /assertPlatformAccess\(sr, 'github'\)/);
assert.doesNotMatch(syncSource, /Deno\.Command|child_process|execSync|spawnSync/,
  'Base44 verification must use the provider API, not shell git');
assert.match(syncSource, /checked_at: now/);
assert.match(syncSource, /GitHubSyncCheckpoint\.filter/);
assert.match(syncSource, /GitHubSyncCheckpoint\.create/);
assert.match(syncSource, /\? 'UNCHANGED'/);
assert.match(syncSource, /'FAST_FORWARD'/);
assert.match(syncSource, /'DIVERGED'/);
assert.match(syncSource, /Automatic source movement remains blocked/);
assert.match(syncSource, /safe_for_source_movement:\s*safeForSourceMovement/, 'sync health output must expose an explicit source-movement safety decision');
assert.match(syncSource, /relationship === 'UNCHANGED' \|\| relationship === 'FAST_FORWARD'/, 'only unchanged or fast-forward history may be marked safe for source movement');
assert.doesNotMatch(syncSource, /relationship === 'INITIAL' \|\|/, 'an initial observation must never authorize source movement');
assert.match(syncSource, /\/compare\//, 'provider compare API must classify checkpoint history before future movement');
assert.doesNotMatch(syncSource, /synced_at: now/);
assert.ok(
  syncAnalysis.humanText.includes('[GitHub Verification] One or more connection checks failed'),
  'admin notification title must describe verification failure'
);
assert.ok(
  syncAnalysis.humanText.some((text) => text.startsWith('GitHub connection verification failed for check(s):')),
  'admin notification body must describe verification failure'
);
assertNoFalseSourceMovementClaims(syncAnalysis.humanText, 'base44/functions/syncGitHub/entry.ts');
assertTruthfulAuditActions(syncAnalysis.auditActions, 'base44/functions/syncGitHub/entry.ts');
assert.deepEqual(
  new Set(syncAnalysis.auditActions),
  new Set(['github_connection_verified', 'github_connection_verification_failed']),
  'success and failure audit actions must both remain explicit and truthful'
);

function collectSourceFiles(directory, relative = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const childRelative = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      return collectSourceFiles(new URL(entry.name + '/', directory), childRelative);
    }
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [childRelative] : [];
  });
}

const sourceFiles = collectSourceFiles(new URL('src/', root))
  .map((path) => ['src/' + path, read('src/' + path)]);
const liveCallers = sourceFiles
  .map(([path, source]) => [path, analyzeSource(source, path)])
  .filter(([, analysis]) => analysis.invokedFunctions.includes('syncGitHub'));

// During the GitHub Actions freeze, UI must never invoke the historical
// GitHub connectivity endpoint. Native Base44 release checks replace these.
assert.equal(liveCallers.length, 0,
  'Admin UI must not invoke GitHub connection checks while workflows are paused');
assert.match(read('src/pages/IntegrationsAdmin.jsx'), /<Base44ReleaseStatus/);
assert.match(read('src/components/admin/Base44ReleaseStatus.jsx'), /IFUND_RELEASE_ID/);

assertNoFalseSourceMovementClaims(
  runbook.split(/\n\s*\n/),
  'docs/deferred-base44-workflows.md'
);
assert.match(runbook, /scheduled GitHub workflow definition is intentionally absent/i);
assert.match(runbook, /caller-supplied[\s\S]*initiator_type/i);
assert.match(runbook, /authenticated\s+administrator/i);
assert.match(runbook, /server-verifiable workflow identity/i);

console.log('Base44 source checks remain authorization-safe; GitHub UI calls paused; release status native to Base44.');
