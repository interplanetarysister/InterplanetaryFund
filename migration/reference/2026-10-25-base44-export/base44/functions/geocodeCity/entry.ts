import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { assertActiveAccount } from '../../shared/accountGuard.ts';

// Resolves a free-text city name to lat/lng coordinates using the public
// OpenStreetMap Nominatim geocoder (no API key). The result is stored on the
// Campaign so it can be plotted on the global activity globe.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const activeAccount = await assertActiveAccount(base44);
    if (!activeAccount.ok) return Response.json({ error: activeAccount.error }, { status: activeAccount.status });
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    if (!city || city.length > 200) {
      return Response.json({ error: 'A city name is required' }, { status: 400 });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'InterplanetaryFund/1.0 (geocoding)' },
    });
    if (!r.ok) return Response.json({ error: 'Geocoding service unavailable' }, { status: 502 });
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }
    const hit = data[0];
    return Response.json({
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      display: hit.display_name,
    });
  } catch (error) {
    console.error('geocodeCity error:', error);
    return Response.json({ error: 'Unable to geocode this location right now' }, { status: 500 });
  }
}