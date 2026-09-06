import { NextResponse } from 'next/server';
import { getCity } from '@/lib/cities';
import { fuse, interpolate } from '@/lib/fusion';
import { getForecast, pointsAt } from '@/lib/openmeteo';
import { getCells } from '@/lib/staticData';

export const runtime = 'nodejs';
// The forecast is hourly and the static layer never changes; recomputing per
// request is wasted work during a demo where judges click a lot.
export const revalidate = 900;

/**
 * GET /api/risk?city=pune&at=<iso>&tempOffset=<°C>
 *
 * Returns the fused risk surface as GeoJSON, one polygon per grid cell.
 * `tempOffset` shifts the whole forecast — it exists so a demo on a mild day
 * can still show what the tool does in a heatwave, and the response says
 * plainly when it has been used so nothing is ever passed off as a real
 * forecast.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = getCity(url.searchParams.get('city'));
  const at = url.searchParams.get('at') ? new Date(url.searchParams.get('at')!) : new Date();
  const tempOffset = Number(url.searchParams.get('tempOffset') ?? 0) || 0;

  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: 'Invalid `at` timestamp' }, { status: 400 });
  }
  if (Math.abs(tempOffset) > 20) {
    return NextResponse.json({ error: '`tempOffset` must be within ±20 °C' }, { status: 400 });
  }

  const [cells, forecast] = await Promise.all([
    getCells(city),
    getForecast(city).catch(() => null),
  ]);

  if (cells.length === 0) {
    return NextResponse.json(
      { error: `No grid cells seeded for ${city.name}. Run: npm run seed -- ${city.key}` },
      { status: 503 },
    );
  }
  if (!forecast || forecast.points.length === 0) {
    return NextResponse.json(
      { error: 'Forecast unavailable and nothing cached. The risk layer needs a forecast.' },
      { status: 503 },
    );
  }

  const slice = pointsAt(forecast.points, at);
  const lattice = slice.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    value: p.apparentC + tempOffset,
  }));
  const validAt = slice[0]?.validAt ?? at;
  const half = city.cellSize / 2;

  let peak = { risk: -1, lat: 0, lng: 0, population: 0 };
  let populationAtRisk = 0;

  const features = cells.map((c) => {
    const regional = interpolate(c.lat, c.lng, lattice);
    const f = fuse(regional, c.heatProxy, c.vulnerability);
    if (f.risk >= 60) populationAtRisk += c.population;
    if (f.risk > peak.risk) {
      peak = { risk: f.risk, lat: c.lat, lng: c.lng, population: c.population };
    }
    return {
      type: 'Feature' as const,
      id: c.id,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [c.lng - half, c.lat - half],
            [c.lng + half, c.lat - half],
            [c.lng + half, c.lat + half],
            [c.lng - half, c.lat + half],
            [c.lng - half, c.lat - half],
          ],
        ],
      },
      properties: {
        id: c.id,
        risk: round(f.risk, 1),
        feelsLikeC: round(f.feelsLikeC, 1),
        regionalC: round(regional, 1),
        vulnerability: round(c.vulnerability, 1),
        heatProxy: round(c.heatProxy, 3),
        buildingDensity: round(c.buildingDensity, 3),
        greenCover: round(c.greenCover, 3),
        waterProximity: round(c.waterProximity, 3),
        population: c.population,
        lat: c.lat,
        lng: c.lng,
      },
    };
  });

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    meta: {
      city: city.key,
      cityName: city.name,
      validAt: validAt.toISOString(),
      requestedAt: at.toISOString(),
      forecastFetchedAt: forecast.fetchedAt?.toISOString() ?? null,
      forecastStale: forecast.stale,
      tempOffset,
      simulated: tempOffset !== 0,
      source: 'Open-Meteo',
      cells: cells.length,
      populationAtRisk,
      totalPopulation: cells.reduce((a, c) => a + c.population, 0),
      peak: { ...peak, risk: round(peak.risk, 1) },
    },
  });
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
