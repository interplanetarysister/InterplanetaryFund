import { geocodeCity } from './geocodeCity.js';
import { response } from './reads.js';
import { verificationPage, verificationScript } from './geocodeVerifier.js';

// Isolated staging entrypoint. No catch-all proxy, scheduler, other API dispatch,
// production route, or private key. The optional verifier uses a publishable key.
export default {
  async fetch(request, env = {}) {
    const path = new URL(request.url).pathname;
    if (path === '/functions/geocodeCity' ||
        path === '/api/apps/6a67a778342a8fe05ee79cba/functions/geocodeCity') {
      return geocodeCity(request, env);
    }
    if (env.IFUND_GEOCODE_VERIFIER !== 'enabled' || request.method !== 'GET') {
      return response(404, { error: 'Not found.' });
    }
    const headers = {
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; script-src 'self'; connect-src 'self' https://ssibsfmtodgximseeqsv.supabase.co; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
    };
    if (path === '/__verify/geocode') {
      return new Response(verificationPage, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
    }
    if (path === '/__verify/geocode.js') {
      return new Response(verificationScript, { headers: { ...headers, 'content-type': 'application/javascript; charset=utf-8' } });
    }
    if (path === '/__verify/config') {
      if (env.SUPABASE_URL !== 'https://ssibsfmtodgximseeqsv.supabase.co' ||
          typeof env.SUPABASE_PUBLISHABLE_KEY !== 'string' || !env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
        return response(503, { error: 'Staging verification is not configured.' });
      }
      return response(200, { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY });
    }
    return response(404, { error: 'Not found.' });
  },
};
