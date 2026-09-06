/**
 * Reverse geocoding, so an advisory says "Kothrud" instead of "18.5065, 73.8077".
 *
 * Nominatim is free and keyless but explicitly rate-limited to one request a
 * second and requires a real User-Agent. Results are memoised per cell centre,
 * and the advisory route caches the finished text per area per day, so a demo
 * makes a handful of calls at most.
 */

const cache = new Map<string, string>();

export async function areaName(lat: number, lng: number, fallback: string): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('zoom', '14'); // suburb / neighbourhood level
    url.searchParams.set('accept-language', 'en');

    const res = await fetch(url, {
      headers: { 'User-Agent': 'HeatShield/0.1 (github.com/sahilkarande0918-cmd/HeatShield)' },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const j = (await res.json()) as { address?: Record<string, string>; name?: string };
    const a = j.address ?? {};
    const name =
      a.suburb ??
      a.neighbourhood ??
      a.village ??
      a.town ??
      a.city_district ??
      a.county ??
      j.name ??
      fallback;
    cache.set(key, name);
    return name;
  } catch (err) {
    // A missing place name must never block an advisory.
    console.error('[geocode] reverse lookup failed:', err);
    return fallback;
  }
}
