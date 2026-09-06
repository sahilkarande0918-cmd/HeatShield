import { NextResponse } from 'next/server';
import { getCity } from '@/lib/cities';
import { fuse, interpolate } from '@/lib/fusion';
import { getForecast, pointsAt } from '@/lib/openmeteo';
import { optimiseSites, type DemandCell } from '@/lib/optimizer';
import { getCells, getFacilities } from '@/lib/staticData';

export const runtime = 'nodejs';

/**
 * GET /api/optimize?city=pune&at=<iso>&tempOffset=<°C>&sites=5&radiusKm=1&counts=<kinds>
 *
 * Runs the siting optimizer against the risk surface for that moment. The
 * comparison it returns — what existing relief reaches versus what the
 * recommended placements would reach — is the number this whole project is
 * built to produce.
 *
 * `counts` decides what is treated as heat relief that already exists.
 * Default is water points alone, and that is a modelling judgement worth
 * stating out loud rather than burying: a hospital is where somebody goes
 * after heatstroke, not somewhere they go to avoid it, and OSM tags a great
 * many small private clinics in Indian cities. Counting all of them makes
 * existing coverage look near-total. The dashboard exposes this as a toggle so
 * the assumption is the user's to inspect and overrule, not ours to hide.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = getCity(url.searchParams.get('city'));
  const at = url.searchParams.get('at') ? new Date(url.searchParams.get('at')!) : new Date();
  const tempOffset = Number(url.searchParams.get('tempOffset') ?? 0) || 0;
  const k = clampInt(url.searchParams.get('sites'), 1, 12, 5);
  const radiusKm = clampFloat(url.searchParams.get('radiusKm'), 0.3, 5, 1);
  const counts = new Set(
    (url.searchParams.get('counts') ?? 'water_point')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => ['water_point', 'hospital', 'clinic'].includes(s)),
  );

  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: 'Invalid `at` timestamp' }, { status: 400 });
  }
  if (Math.abs(tempOffset) > 20) {
    return NextResponse.json({ error: '`tempOffset` must be within ±20 °C' }, { status: 400 });
  }

  const [cells, existing, forecast] = await Promise.all([
    getCells(city),
    getFacilities(city),
    getForecast(city).catch(() => null),
  ]);

  if (cells.length === 0) {
    return NextResponse.json(
      { error: `No grid cells seeded for ${city.name}. Run: npm run seed -- ${city.key}` },
      { status: 503 },
    );
  }
  if (!forecast || forecast.points.length === 0) {
    return NextResponse.json({ error: 'Forecast unavailable.' }, { status: 503 });
  }

  const lattice = pointsAt(forecast.points, at).map((p) => ({
    lat: p.lat,
    lng: p.lng,
    value: p.apparentC + tempOffset,
  }));

  const demand: DemandCell[] = cells.map((c) => ({
    lat: c.lat,
    lng: c.lng,
    population: c.population,
    risk: fuse(interpolate(c.lat, c.lng, lattice), c.heatProxy, c.vulnerability).risk,
  }));

  const started = Date.now();
  const relief = existing.filter((f) => counts.has(f.kind));
  const result = optimiseSites(demand, relief, { k, radiusKm });
  const ms = Date.now() - started;

  return NextResponse.json({
    city: city.key,
    cityName: city.name,
    at: at.toISOString(),
    tempOffset,
    simulated: tempOffset !== 0,
    existingCount: relief.length,
    existingTotal: existing.length,
    counts: [...counts],
    byKind: existing.reduce<Record<string, number>>((a, f) => {
      a[f.kind] = (a[f.kind] ?? 0) + 1;
      return a;
    }, {}),
    computeMs: ms,
    ...result,
    // Share of at-risk demand reached, before and after. Zero demand means a
    // mild day: report null rather than a misleading 0% or 100%.
    baselineShare: result.totalDemand > 0 ? result.baselineCovered / result.totalDemand : null,
    proposedShare: result.totalDemand > 0 ? result.proposedCovered / result.totalDemand : null,
  });
}

function clampInt(raw: string | null, lo: number, hi: number, fallback: number) {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

function clampFloat(raw: string | null, lo: number, hi: number, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) && raw !== null ? Math.min(hi, Math.max(lo, n)) : fallback;
}
