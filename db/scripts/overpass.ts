import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const CACHE = join(process.cwd(), 'db', '.cache');
const ENDPOINT = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Overpass is a shared free service that throttles hard. Every response is
 * cached on disk keyed by the query, so re-running the seed (which you will,
 * while tuning weights) costs nothing and the API is hit exactly once per
 * distinct query.
 */
export async function overpass(query: string, label: string): Promise<OsmElement[]> {
  mkdirSync(CACHE, { recursive: true });
  const key = createHash('sha1').update(query).digest('hex').slice(0, 16);
  const file = join(CACHE, `${label}-${key}.json`);
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, 'utf8')).elements as OsmElement[];
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass returns a bare 406 to the default Node user-agent.
          'User-Agent': 'HeatShield/0.1 (github.com/sahilkarande0918-cmd/HeatShield)',
          Accept: 'application/json',
        },
      });
      if (res.status === 429 || res.status === 504) throw new Error(`overpass ${res.status}`);
      if (!res.ok) throw new Error(`overpass ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { elements: OsmElement[] };
      writeFileSync(file, JSON.stringify(json));
      await sleep(1500); // be a good citizen on a free shared endpoint
      return json.elements;
    } catch (err) {
      lastErr = err;
      const wait = 4000 * attempt;
      console.warn(`  ${label}: attempt ${attempt} failed (${String(err)}), retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/** Split a bbox into tiles so no single Overpass query is unreasonably large. */
export function tiles(
  bbox: [number, number, number, number],
  step: number,
): [number, number, number, number][] {
  const [w, s, e, n] = bbox;
  const out: [number, number, number, number][] = [];
  for (let y = s; y < n; y += step) {
    for (let x = w; x < e; x += step) {
      out.push([x, y, Math.min(x + step, e), Math.min(y + step, n)]);
    }
  }
  return out;
}

/** Overpass wants bbox as south,west,north,east. */
export const bboxStr = (b: [number, number, number, number]) => `${b[1]},${b[0]},${b[3]},${b[2]}`;

export function elementCenter(el: OsmElement): { lat: number; lon: number } | null {
  if (el.center) return el.center;
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.bounds) {
    return {
      lat: (el.bounds.minlat + el.bounds.maxlat) / 2,
      lon: (el.bounds.minlon + el.bounds.maxlon) / 2,
    };
  }
  return null;
}
