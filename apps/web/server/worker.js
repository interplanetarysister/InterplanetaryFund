import api from '../../../worker/index.js';

// Pages Advanced Mode: real independent API handlers share the frontend origin.
// No Base44 fallback, service-role key or alternate Supabase project.
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/') || path === '/functions/geocodeCity') {
      return api.fetch(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
