import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.jsx', import.meta.url), 'utf8');
const pullToRefresh = readFileSync(new URL('../src/components/mobile/PullToRefresh.jsx', import.meta.url), 'utf8');
const cryptoDonateOption = readFileSync(new URL('../src/components/payments/CryptoDonateOption.jsx', import.meta.url), 'utf8');

function stripComments(source) {
  let output = '';
  let quote = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (quote) {
      output += char;
      if (char === '\\' && next !== undefined) {
        output += next;
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char.charCodeAt(0) === 96) {
      quote = char;
      output += char;
      continue;
    }

    if (char === '/' && next === '*') {
      output += '  ';
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        output += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < source.length) {
        output += '  ';
        i += 1;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      output += '  ';
      i += 2;
      while (i < source.length && source[i] !== '\n') {
        output += ' ';
        i += 1;
      }
      if (i < source.length) output += '\n';
      continue;
    }

    output += char;
  }

  return output;
}

function skipQuoted(source, start) {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === quote) return index + 1;
    index += 1;
  }
  return source.length;
}

function skipBalancedBraces(source, start) {
  let depth = 0;
  let index = start;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'" || char.charCodeAt(0) === 96) {
      index = skipQuoted(source, index);
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return source.length;
}

function staticClassSetsForTag(source, tagName) {
  const clean = stripComments(source);
  const classSets = [];
  let index = 0;

  while ((index = clean.indexOf('<', index)) !== -1) {
    let cursor = index + 1;
    if (clean[cursor] === '/') {
      index = cursor + 1;
      continue;
    }

    const nameStart = cursor;
    while (/[A-Za-z0-9_.:-]/.test(clean[cursor] || '')) cursor += 1;
    if (clean.slice(nameStart, cursor) !== tagName) {
      index = Math.max(cursor, index + 1);
      continue;
    }

    while (cursor < clean.length) {
      while (/\s/.test(clean[cursor] || '')) cursor += 1;
      if (clean[cursor] === '>' || (clean[cursor] === '/' && clean[cursor + 1] === '>')) {
        index = cursor + 1;
        break;
      }

      const attributeStart = cursor;
      while (cursor < clean.length && !/[\s=/>]/.test(clean[cursor])) cursor += 1;
      const attributeName = clean.slice(attributeStart, cursor);
      while (/\s/.test(clean[cursor] || '')) cursor += 1;

      if (clean[cursor] !== '=') continue;
      cursor += 1;
      while (/\s/.test(clean[cursor] || '')) cursor += 1;

      const delimiter = clean[cursor];
      if (delimiter === '"' || delimiter === "'") {
        const valueStart = cursor + 1;
        cursor = skipQuoted(clean, cursor);
        if (attributeName === 'className') {
          const value = clean.slice(valueStart, Math.max(valueStart, cursor - 1));
          classSets.push(new Set(value.trim().split(/\s+/).filter(Boolean)));
        }
      } else if (delimiter === '{') {
        cursor = skipBalancedBraces(clean, cursor);
      } else {
        while (cursor < clean.length && !/[\s>]/.test(clean[cursor])) cursor += 1;
      }
    }

    if (cursor >= clean.length) break;
  }

  return classSets;
}

function hasStaticElementClasses(source, tagName, requiredClasses) {
  return staticClassSetsForTag(source, tagName)
    .some((classes) => requiredClasses.every((className) => classes.has(className)));
}

function cssRuleBodiesForSelector(source, selector) {
  const clean = stripComments(source);
  const stack = [];
  const bodies = [];
  let boundary = 0;
  let index = 0;

  while (index < clean.length) {
    const char = clean[index];
    if (char === '"' || char === "'") {
      index = skipQuoted(clean, index);
      continue;
    }
    if (char === '{') {
      stack.push({ prelude: clean.slice(boundary, index).trim(), bodyStart: index + 1 });
      boundary = index + 1;
    } else if (char === '}') {
      const rule = stack.pop();
      if (rule && rule.prelude.split(',').map((part) => part.trim()).includes(selector)) {
        bodies.push(clean.slice(rule.bodyStart, index));
      }
      boundary = index + 1;
    } else if (char === ';') {
      boundary = index + 1;
    }
    index += 1;
  }

  return bodies;
}

function topLevelCssText(body) {
  let output = '';
  let depth = 0;
  let index = 0;

  while (index < body.length) {
    const char = body[index];
    if (char === '"' || char === "'") {
      const end = skipQuoted(body, index);
      if (depth === 0) output += ' ';
      index = end;
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      output += char;
    }
    index += 1;
  }

  return output;
}

function ruleAppliesClasses(source, selector, requiredClasses) {
  return cssRuleBodiesForSelector(source, selector).some((body) => {
    const directText = topLevelCssText(body);
    return [...directText.matchAll(/(?:^|;)\s*@apply\s+([^;]+);/g)].some((match) => {
      const classes = new Set(match[1].trim().split(/\s+/).filter(Boolean));
      return requiredClasses.every((className) => classes.has(className));
    });
  });
}

function ruleHasDeclaration(source, selector, property, expectedValue) {
  return cssRuleBodiesForSelector(source, selector).some((body) => {
    const directText = topLevelCssText(body);
    const declaration = new RegExp('(?:^|;)\\s*' + property + '\\s*:\\s*([^;]+);', 'g');
    return [...directText.matchAll(declaration)].some(
      (match) => match[1].replace(/\s+/g, '') === expectedValue.replace(/\s+/g, '')
    );
  });
}

assert.ok(
  ruleAppliesClasses(css, 'body', ['bg-background', 'text-foreground']),
  'body must define semantic background and foreground regardless of class order'
);
assert.ok(
  ruleHasDeclaration(css, '.deep-space', 'color', 'hsl(var(--sidebar-foreground))'),
  'deep-space surfaces must set a readable inherited foreground'
);
assert.ok(
  hasStaticElementClasses(layout, 'main', ['bg-background', 'text-foreground']),
  'shared app main must explicitly pair background and foreground regardless of class order'
);
assert.ok(
  ['h-screen', 'h-dvh', 'min-h-screen', 'min-h-dvh'].some((heightClass) =>
    hasStaticElementClasses(layout, 'div', [heightClass, 'bg-background', 'text-foreground'])
  ),
  'shared app shell must pair a viewport-height class with semantic background and foreground'
);

// Parser regression fixtures: comments, unrelated attributes/selectors, and
// missing color roles must never satisfy the production contract.
assert.equal(
  hasStaticElementClasses(
    '<div className="text-foreground min-h-dvh bg-background">',
    'div',
    ['min-h-dvh', 'bg-background', 'text-foreground']
  ),
  true,
  'semantic class checks must accept reordered class tokens'
);
assert.equal(
  hasStaticElementClasses(
    '{/* <div className="min-h-dvh bg-background text-foreground"> */}',
    'div',
    ['min-h-dvh', 'bg-background', 'text-foreground']
  ),
  false,
  'commented JSX must not satisfy the shell contract'
);
assert.equal(
  hasStaticElementClasses(
    '<div data-note=\'className="min-h-dvh bg-background text-foreground"\'>',
    'div',
    ['min-h-dvh', 'bg-background', 'text-foreground']
  ),
  false,
  'className text inside an unrelated attribute must not satisfy the shell contract'
);
assert.equal(
  hasStaticElementClasses(
    '<div className="min-h-dvh bg-background">',
    'div',
    ['min-h-dvh', 'bg-background', 'text-foreground']
  ),
  false,
  'a shell missing its foreground role must fail'
);
assert.equal(
  ruleAppliesClasses(
    '/* body { @apply bg-background text-foreground; } */',
    'body',
    ['bg-background', 'text-foreground']
  ),
  false,
  'commented CSS must not satisfy the body contract'
);
assert.equal(
  ruleAppliesClasses(
    '.somebody { @apply bg-background text-foreground; }',
    'body',
    ['bg-background', 'text-foreground']
  ),
  false,
  'an unrelated selector must not satisfy the body contract'
);
assert.equal(
  ruleAppliesClasses(
    'body { color: red; .nested { @apply bg-background text-foreground; } }',
    'body',
    ['bg-background', 'text-foreground']
  ),
  false,
  'a nested unrelated rule must not satisfy the body contract'
);
assert.equal(
  ruleAppliesClasses(
    'body { @apply text-foreground font-body bg-background; }',
    'body',
    ['bg-background', 'text-foreground']
  ),
  true,
  'semantic CSS checks must accept reordered class tokens'
);
assert.equal(
  ruleAppliesClasses(
    'body { @apply bg-background font-body; }',
    'body',
    ['bg-background', 'text-foreground']
  ),
  false,
  'a body rule missing its foreground role must fail'
);


assert.ok(
  ruleHasDeclaration(css, 'html', 'touch-action', 'pan-y') ||
    ruleHasDeclaration(css, 'body', 'touch-action', 'pan-y'),
  'page must enforce ordinary one-finger vertical panning without pinch-zoom gesture coupling'
);
assert.doesNotMatch(
  css,
  /touch-action:\s*pan-y\s+pinch-zoom/i,
  'shared web/app surfaces must not reintroduce the two-finger pinch-zoom gesture into page scrolling'
);
assert.match(
  layout,
  /<main[^>]*data-page-scroll[^>]*overflow-y-auto/,
  'the routed application must use an explicit one-finger vertical page scroll container'
);
assert.match(
  css,
  /#root[\s\S]{0,500}overflow-y:\s*auto/,
  'public and unauthenticated pages must retain an explicit root vertical scroll surface'
);
assert.doesNotMatch(
  css,
  /html\s*,\s*body\s*,\s*#root\s*\{[\s\S]{0,500}overscroll-behavior:\s*none/,
  'the global page scroll surface must not suppress vertical overscroll handling'
);
assert.doesNotMatch(
  pullToRefresh,
  /touchmove[\s\S]{0,1200}preventDefault\s*\(/,
  'pull-to-refresh must never cancel one-finger touchmove scrolling'
);
assert.match(
  pullToRefresh,
  /touchmove[\s\S]{0,1200}passive:\s*true/,
  'pull-to-refresh touchmove observation must remain passive'
);
assert.ok(
  ruleHasDeclaration(css, 'input', '-webkit-text-fill-color', 'hsl(var(--foreground))') ||
    css.includes('-webkit-text-fill-color: hsl(var(--foreground));'),
  'editable controls must preserve readable entered text'
);
assert.doesNotMatch(
  css,
  /(?:button|\[role="button"\])\.(?:bg|border)-[A-Za-z0-9_-]+/,
  'global button contrast selectors must use exact class-token attributes so Tailwind cannot rewrite hover/state variants into invalid selectors'
);
assert.match(css, /button\[class~="bg-primary"\]/);
assert.match(css, /\[role="button"\]\[class~="bg-secondary"\]/);

const unsafeTextPairs = [
  /bg-slate-(?:900|950)[^"'\n]*text-(?:slate|gray|zinc|neutral)-(?:700|800|900)/g,
  /bg-(?:white|slate-50|gray-50)(?!\/)[^"'\n]*text-(?:white|slate-50|gray-50)(?:\s|["'])/g,
];
const srcRoot = new URL('../src/', import.meta.url);
import { readdirSync } from 'node:fs';
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    return entry.isDirectory() ? walk(url) : /\.(?:jsx|tsx|js|ts)$/.test(entry.name) ? [url] : [];
  });
}
const contrastViolations = [];
for (const file of walk(srcRoot)) {
  const source = stripComments(readFileSync(file, 'utf8'));
  for (const pattern of unsafeTextPairs) {
    for (const match of source.matchAll(pattern)) contrastViolations.push(file.pathname + ': ' + match[0]);
  }
}
assert.deepEqual(contrastViolations, [], 'obvious same-tone foreground/background combinations are forbidden:\n' + contrastViolations.join('\n'));

// Crypto donation information appears on the homepage and campaign checkout.
// Preserve readable foreground/background pairings in both user color modes.
assert.ok(
  hasStaticElementClasses(cryptoDonateOption, 'section',
    ['bg-violet-50', 'text-slate-950', 'dark:bg-slate-900', 'dark:text-slate-50']),
  'crypto panel must declare matched backgrounds and foregrounds for light and dark modes'
);
assert.ok(
  hasStaticElementClasses(cryptoDonateOption, 'h3', ['text-violet-900', 'dark:text-violet-100']),
  'crypto heading must remain readable on each panel surface'
);
assert.ok(
  hasStaticElementClasses(cryptoDonateOption, 'p',
    ['bg-amber-50', 'text-amber-950', 'dark:bg-amber-200/10', 'dark:text-amber-100']),
  'crypto readiness warning must have legible text in both modes'
);
function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const components = hex.match(/[a-f0-9]{2}/gi).map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
  };
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}
for (const [name, fg, bg] of [
  ['light crypto body', '020617', 'f5f3ff'],
  ['light crypto heading', '4c1d95', 'f5f3ff'],
  ['dark crypto body', 'f8fafc', '0f172a'],
  ['dark crypto heading', 'ede9fe', '0f172a'],
  ['light readiness warning', '451a03', 'fffbeb'],
  ['dark readiness warning', 'fef3c7', '282c34'],
]) {
  assert.ok(contrastRatio(fg, bg) >= 4.5, name + ' must meet WCAG AA normal-text contrast');
}

console.log('Shared text contrast contract passed, including crypto donation panels in both color modes.');
