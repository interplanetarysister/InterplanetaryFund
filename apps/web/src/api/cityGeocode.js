import { normalizeCityQuery, verifiedCityLocation } from '../lib/cityGeocodeContract.mjs';
import { payoutIdentity } from '../lib/guestAccess.js';

/** Explicit city lookup; no GPS, campaign write, or implicit map opt-in. */
export async function lookupCampaignCity(client, value, { fetcher = fetch, signal } = {}) {
  const city = normalizeCityQuery(value);
  const before = await client.auth.getUser();
  const owner = before.data?.user;
  if (before.error || !payoutIdentity(owner)) throw new Error('Sign in with a confirmed email account to search for another city.');
  const session = await client.auth.getSession();
  if (session.error || session.data?.session?.user?.id !== owner.id || !session.data.session.access_token)
    throw new Error('Your account changed. Retry city search after signing in.');
  const result = await fetcher('/api/geocode/city', { method: 'POST', signal,
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + session.data.session.access_token },
    body: JSON.stringify({ city }) });
  const after = await client.auth.getUser();
  if (after.error || !payoutIdentity(after.data?.user) || after.data.user.id !== owner.id)
    throw new Error('Your account changed before the city location could be shown.');
  if (!result.ok) {
    const message = result.status === 429 ? 'City search is busy or its limit is reached. Wait a moment and try again.'
      : result.status === 404 ? 'City not found. Add a region or country and try again.'
      : 'City search is unavailable. Choose a broad city preset or try again later.';
    throw new Error(message);
  }
  return verifiedCityLocation(await result.json());
}
