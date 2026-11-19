// Pages with their own semantic <main> must not be wrapped by another main.
// The fallback role is provided only for pages whose root is a different element.
// Keep this list checked against router page modules by route-main-landmark.test.mjs.
const LAYOUT_OWN_MAIN_MISSING = Object.freeze([
  /^\/discover\/?$/,
  /^\/(?:agents|mission|analytics|connections|permissions|community|social|profile|inbox|blogs|news|help)\/?$/,
  /^\/u\/[^/]+\/?$/,
  /^\/blogs\/[^/]+\/?$/,
  /^\/publications\/[^/]+\/?$/,
  /^\/campaign\/[^/]+\/?$/,
]);

export function needsLayoutMainLandmark(pathname) {
  const path=String(pathname||"");
  return LAYOUT_OWN_MAIN_MISSING.some(pattern=>pattern.test(path));
}
