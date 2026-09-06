import { NextResponse } from 'next/server';
import { getCity } from '@/lib/cities';
import { fuse } from '@/lib/fusion';
import { getForecast } from '@/lib/openmeteo';
import { getCells } from '@/lib/staticData';

export const runtime = 'nodejs';
export const revalidate = 900;

/**
 * GET /api/forecast?city=pune&tempOffset=<°C>
 *
 * The next 72 hours as a timeseries, for the trend chart. Each hour carries
 * the citywide mean apparent temperature plus the risk of the *worst* cell
 * and the *median* cell, because the gap between those two lines is the whole
 * argument: a citywide average hides the block that is in trouble.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = getCity(url.searchParams.get('city'));
  const tempOffset = Number(url.searchParams.get('tempOffset') ?? 0) || 0;
  if (Math.abs(tempOffset) > 20) {
    return NextResponse.json({ error: '`tempOffset` must be within ±20 °C' }, { status: 400 });
  }

  const [cells, forecast] = await Promise.all([
    getCells(city),
    getForecast(city).catch(() => null),
  ]);

  if (!forecast || forecast.points.length === 0 || cells.length === 0) {
    return NextResponse.json({ error: 'No forecast or no seeded grid.' }, { status: 503 });
  }

  // Average the lattice per hour: the chart is a citywide summary, so the
  // spatial detail that /api/risk needs is not useful here.
  const byHour = new Map<number, { apparent: number[]; temp: number[]; rh: number[] }>();
  for (const p of forecast.points) {
    const t = p.validAt.getTime();
    if (!byHour.has(t)) byHour.set(t, { apparent: [], temp: [], rh: [] });
    const b = byHour.get(t)!;
    b.apparent.push(p.apparentC + tempOffset);
    b.temp.push(p.tempC + tempOffset);
    b.rh.push(p.humidity);
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const cutoff = Date.now() + 72 * 3600_000;

  const series = [...byHour.entries()]
    .filter(([t]) => t <= cutoff)
    .sort((a, b) => a[0] - b[0])
    .map(([t, b]) => {
      const apparent = mean(b.apparent);
      const risks = cells
        .map((c) => fuse(apparent, c.heatProxy, c.vulnerability).risk)
        .sort((x, y) => x - y);
      return {
        t: new Date(t).toISOString(),
        apparentC: round(apparent, 1),
        tempC: round(mean(b.temp), 1),
        humidity: round(mean(b.rh), 0),
        worstRisk: round(risks[risks.length - 1], 1),
        medianRisk: round(risks[Math.floor(risks.length / 2)], 1),
      };
    });

  return NextResponse.json({
    city: city.key,
    cityName: city.name,
    tempOffset,
    simulated: tempOffset !== 0,
    stale: forecast.stale,
    fetchedAt: forecast.fetchedAt?.toISOString() ?? null,
    source: 'Open-Meteo',
    series,
  });
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
