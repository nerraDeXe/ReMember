import { config } from '../config/config.js';

const DEFAULT_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const REQUEST_INTERVAL_MS = 1000;

export class EventLocationError extends Error {
  constructor(message, status = 503, retryAfter = 0) {
    super(message);
    this.name = 'EventLocationError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function searchQuery(value) {
  if (typeof value !== 'string') throw new EventLocationError('Enter a place or address using 3 to 200 characters.', 400);
  const query = value.trim().replace(/\s+/g, ' ');
  if (query.length < 3 || query.length > 200) throw new EventLocationError('Enter a place or address using 3 to 200 characters.', 400);
  return query;
}

function providerLocations(value) {
  if (!Array.isArray(value)) throw new EventLocationError('Location search returned an invalid response. Please try again.', 502);
  const locations = [];
  const ids = new Set();
  for (const item of value.slice(0, 50)) {
    if (!item || typeof item.display_name !== 'string') continue;
    const label = item.display_name.trim().replace(/\s+/g, ' ').slice(0, 500);
    const validCoordinate = coordinate => (typeof coordinate === 'number' || (typeof coordinate === 'string' && coordinate.trim() !== '')) && Number.isFinite(Number(coordinate));
    if (!label || !validCoordinate(item.lat) || !validCoordinate(item.lon)) continue;
    const latitude = Number(item.lat), longitude = Number(item.lon);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) continue;
    const id = ['node', 'way', 'relation'].includes(item.osm_type) && /^\d{1,30}$/.test(String(item.osm_id))
      ? `${item.osm_type}:${item.osm_id}`
      : /^\d{1,30}$/.test(String(item.place_id)) ? `place:${item.place_id}` : `${latitude},${longitude}`;
    if (ids.has(id)) continue;
    ids.add(id);
    locations.push({ id, label, latitude, longitude });
    if (locations.length === 5) break;
  }
  return locations;
}

function retrySeconds(response, now, fallback) {
  const value = response.headers?.get?.('retry-after');
  if (value && /^\d+$/.test(value)) return Math.max(1, Math.min(3600, Number(value)));
  const date = value && Date.parse(value);
  return date && Number.isFinite(date) ? Math.max(1, Math.min(3600, Math.ceil((date - now) / 1000))) : fallback;
}

/**
 * One shared instance serves the whole backend. Nominatim's public service permits
 * user-triggered searches, at most one request/second, with identifying headers.
 * Repeated queries share cached results; different queries never queue up.
 */
export function createEventLocationService({
  fetch: fetchProvider = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  endpoint = process.env.NOMINATIM_BASE_URL || DEFAULT_ENDPOINT,
  userAgent = process.env.NOMINATIM_USER_AGENT || (config.APP_WEB_URL ? `ReMember/1.0 (+${config.APP_WEB_URL})` : ''),
  timeoutMs = 7000,
  cacheTtlMs = CACHE_TTL_MS,
  cacheMaxEntries = CACHE_MAX_ENTRIES,
} = {}) {
  const cache = new Map();
  let pending = null;
  let nextAllowedAt = 0;

  async function search(value) {
    const query = searchQuery(value);
    const key = query.toLocaleLowerCase('en');
    const currentTime = now();
    for (const [cacheKey, entry] of cache) if (entry.expiresAt <= currentTime) cache.delete(cacheKey);
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return structuredClone(cached.locations);
    }
    if (pending?.key === key) return pending.promise.then(structuredClone);
    if (pending || currentTime < nextAllowedAt) {
      throw new EventLocationError('Location search is busy. Wait a moment and search again.', 429, Math.max(1, Math.ceil((nextAllowedAt - currentTime) / 1000)));
    }

    let url;
    try {
      url = new URL(endpoint);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid endpoint');
      if (!userAgent || /[\r\n]/.test(userAgent)) throw new Error('Invalid user agent');
    } catch {
      throw new EventLocationError('Location search is not configured. Ask your administrator to check the server settings.');
    }
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('accept-language', 'en');
    nextAllowedAt = currentTime + REQUEST_INTERVAL_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const promise = (async () => {
      try {
        const response = await fetchProvider(url.toString(), {
          headers: { 'User-Agent': userAgent, Accept: 'application/json', 'Accept-Language': 'en' },
          signal: controller.signal,
          redirect: 'error',
        });
        if (!response.ok) {
          if (response.status === 429 || response.status === 503) {
            const retryAfter = retrySeconds(response, now(), response.status === 429 ? 60 : 10);
            nextAllowedAt = Math.max(nextAllowedAt, now() + retryAfter * 1000);
            throw new EventLocationError('Location search is temporarily unavailable. Please try again shortly.', response.status, retryAfter);
          }
          throw new EventLocationError('Location search could not be completed. Please try again.', 502);
        }
        let payload;
        try { payload = await response.json(); }
        catch (error) {
          if (controller.signal.aborted) throw error;
          throw new EventLocationError('Location search returned an invalid response. Please try again.', 502);
        }
        const locations = providerLocations(payload);
        cache.set(key, { locations, expiresAt: now() + cacheTtlMs });
        while (cache.size > cacheMaxEntries) cache.delete(cache.keys().next().value);
        return locations;
      } catch (error) {
        if (error instanceof EventLocationError) throw error;
        if (controller.signal.aborted) throw new EventLocationError('Location search timed out. Please try again.', 503, 1);
        throw new EventLocationError('Location search is temporarily unavailable. Please try again.', 503, 1);
      } finally {
        clearTimeout(timeout);
      }
    })();
    pending = { key, promise };
    try { return structuredClone(await promise); }
    finally { if (pending?.promise === promise) pending = null; }
  }

  return { search };
}

export const eventLocationService = createEventLocationService();
