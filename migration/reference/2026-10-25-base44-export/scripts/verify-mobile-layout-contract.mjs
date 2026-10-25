import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const dialog = read('src/components/ui/dialog.jsx');
const alertDialog = read('src/components/ui/alert-dialog.jsx');
const sheet = read('src/components/ui/sheet.jsx');
const drawer = read('src/components/ui/drawer.jsx');
const terms = read('src/components/TermsAcceptance.jsx');
const css = read('src/index.css');
const globe = read('src/components/globe/CampaignGlobe.jsx');

for (const source of [dialog, alertDialog]) {
  assert.match(source, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(source, /w-\[calc\(100vw-1rem\)\]/);
  assert.match(source, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(source, /overflow-x-hidden overflow-y-auto/);
  assert.match(source, /\[&>\*\]:min-w-0/);
  assert.match(source, /p-4 sm:p-6/);
}
assert.match(sheet, /overflow-x-hidden overflow-y-auto overscroll-contain/);
assert.match(sheet, /w-\[min\(100vw,28rem\)\]/);
assert.match(sheet, /min-h-\[44px\] min-w-\[44px\]/);
assert.match(drawer, /max-h-\[calc\(100dvh-1rem\)\]/);
assert.match(drawer, /overflow-x-hidden overflow-y-auto overscroll-contain/);
assert.match(terms, /max-w-full overflow-x-hidden/);
assert.match(terms, /min-h-12 h-auto py-3/);
assert.match(css, /touch-action: pan-y/);
assert.match(css, /overflow-x: hidden/);
assert.match(globe, /touchAction = "pan-y"/);
assert.doesNotMatch(globe, /touch-none/);

const connect = read('src/components/connections/ConnectDialog.jsx');
const select = read('src/components/ui/select.jsx');
assert.match(connect, /max-h-\[calc\(100dvh-1\.5rem\)\] overflow-x-hidden/);
assert.match(connect, /\[overflow-wrap:anywhere\]/);
assert.doesNotMatch(connect, /`Link \$\{selectedCampaign\.title\}/, 'Connection action must not use unbounded campaign titles');
assert.match(connect, /whitespace-normal break-words leading-snug/);
assert.match(select, /\[&>span\]:truncate/);
assert.match(select, /leading-snug whitespace-normal break-words/);
console.log('mobile dialog, connection popups and single-touch layout contract: PASS');
