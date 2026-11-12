import app from './app.js';
import assets from './assets.js';
import { judgeTourClient } from './judge-tour-client.js';
import { judgeTourStyles } from './judge-tour-style.js';

const GUIDE_SCRIPT_PATH = '/assets/ifund-judge-guide.js';
const GUIDE_CSS_PATH = '/assets/ifund-judge-guide.css';
const SCRIPT = '(' + judgeTourClient.toString() + ')();';

function guideAsset(body, contentType, request) {
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if ((request.method === 'GET' || request.method === 'HEAD') && path === GUIDE_SCRIPT_PATH) {
      return guideAsset(SCRIPT, 'text/javascript; charset=utf-8', request);
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && path === GUIDE_CSS_PATH) {
      return guideAsset(judgeTourStyles, 'text/css; charset=utf-8', request);
    }
    const response = await app.fetch(request, { ...env, ASSETS: assets }, ctx);
    if (request.method !== 'GET' || !response.ok || path.startsWith('/embed/') ||
        !response.headers.get('content-type')?.includes('text/html')) return response;
    const html = await response.text();
    if (!html.includes('</head>')) {
      return new Response(html, {status: response.status, headers: response.headers});
    }
    const tags = '<link rel="stylesheet" href="' + GUIDE_CSS_PATH +
      '"><script defer src="' + GUIDE_SCRIPT_PATH + '"></script>';
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');
    headers.set('cache-control', 'no-store');
    return new Response(html.replace('</head>', tags + '</head>'), {
      status: response.status, statusText: response.statusText, headers
    });
  },
  scheduled(event, env, ctx) {
    return app.scheduled(event, env, ctx);
  }
};
