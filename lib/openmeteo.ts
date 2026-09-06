import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { forecasts } from '@/db/schema';
import type { City } from './cities';

/**
 * Live forecast, from Open-Meteo.
 *
 * Not IMD. IMD publishes no stable, documented public API, and the Bharat
 * Forecast System is not something a hackathon project can depend on at demo
 * time. Open-Meteo is free, keyless, and has good India coverage; the UI
 * credits it by name rather than implying an official source.
 */

/** How coarse the in-city forecast lattice is. 4x4 = 16 points, one request. */
const LATTICE = 4;

/** Refetch at most once an hour — Open-Meteo updates hourly anyway. */
const CACHE_TTL_MS = 60 * 60 * 1000;

export function forecastLattice(city: City): { lat: number; lng: number }[] {
  const [w, s, e, n] = city.bbox;
  const pts: { lat: number; lng: number }[] = [];
  for (let i = 0; i < LATTICE; i++) {
    for (let j = 0; j < LATTICE; j++) {
      pts.push({
        lat: s + ((n - s) * (i + 0.5)) / LATTICE,
        lng: w + ((e - w) * (j + 0.5)) / LATTICE,
      });
    }
  }
  return pts;
}

type OpenMeteoResponse = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    apparent_temperature: number[];
  };
};

async function fetchOpenMeteo(city: City) {
  const pts = forecastLattice(city);
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', pts.map((p) => p.lat.toFixed(4)).join(','));
  url.searchParams.set('longitude', pts.map((p) => p.lng.toFixed(4)).join(','));
  url.searchParams.set(
    'hourly',
    'temperature_2m,relative_humidity_2m,apparent_temperature',
  );
  url.searchParams.set('forecast_days', '4');
  url.searchParams.set('timezone', 'Asia/Kolkata');

  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  // Multi-location requests return an array; a single location returns an
  // object. We always send many, but be defensive about it.
  const json = await res.json();
  const series: OpenMeteoResponse[] = Array.isArray(json) ? json : [json];

  const rows: (typeof forecasts.$inferInsert)[] = [];
  series.forEach((s, point) => {
    const p = pts[point];
    if (!p || !s.hourly) return;
    s.hourly.time.forEach((t, i) => {
      rows.push({
        city: city.key,
        point,
        lat: p.lat,
        lng: p.lng,
        // Open-Meteo returns local wall time for the requested timezone.
        validAt: new Date(`${t}:00+05:30`),
        tempC: s.hourly.temperature_2m[i],
        humidity: s.hourly.relative_humidity_2m[i],
        apparentC: s.hourly.apparent_temperature[i],
        fetchedAt: new Date(),
      });
    });
  });
  return rows;
}

export type ForecastPoint = {
  point: number;
  lat: number;
  lng: number;
  validAt: Date;
  tempC: number;
  humidity: number;
  apparentC: number;
};

/**
 * Forecast for the city, from cache when it is fresh. If Open-Meteo is slow or
 * down we fall back to whatever is already cached rather than failing the
 * request — a demo should degrade to slightly stale data, never to a spinner.
 */
export async function getForecast(city: City): Promise<{
  points: ForecastPoint[];
  fetchedAt: Date | null;
  stale: boolean;
}> {
  const cached = await db
    .select()
    .from(forecasts)
    .where(
      and(
        eq(forecasts.city, city.key),
        gte(forecasts.validAt, sql`now() - interval '6 hours'`),
      ),
    );

  const newest = cached.reduce<Date | null>(
    (max, r) => (!max || r.fetchedAt > max ? r.fetchedAt : max),
    null,
  );
  const fresh = newest !== null && Date.now() - newest.getTime() < CACHE_TTL_MS;
  if (fresh) return { points: cached, fetchedAt: newest, stale: false };

  try {
    const rows = await fetchOpenMeteo(city);
    await db.delete(forecasts).where(eq(forecasts.city, city.key));
    for (let i = 0; i < rows.length; i += 500) {
      await db.insert(forecasts).values(rows.slice(i, i + 500));
    }
    const kept = rows.filter((r) => r.validAt.getTime() > Date.now() - 6 * 3600_000);
    return {
      points: kept as ForecastPoint[],
      fetchedAt: new Date(),
      stale: false,
    };
  } catch (err) {
    console.error('[forecast] live fetch failed, serving cache:', err);
    if (cached.length > 0) return { points: cached, fetchedAt: newest, stale: true };
    throw err;
  }
}

/** The lattice values valid at (or nearest to) a given instant. */
export function pointsAt(points: ForecastPoint[], at: Date): ForecastPoint[] {
  if (points.length === 0) return [];
  const target = at.getTime();
  let best = Infinity;
  for (const p of points) {
    const d = Math.abs(p.validAt.getTime() - target);
    if (d < best) best = d;
  }
  return points.filter((p) => Math.abs(p.validAt.getTime() - target) === best);
}
