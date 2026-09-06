import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { advisories, facilities, gridCells } from '@/db/schema';
import { generateAdvisory, type AdvisoryInput } from '@/lib/advisory';
import { getCity } from '@/lib/cities';
import { fuse, interpolate } from '@/lib/fusion';
import { areaName } from '@/lib/geocode';
import { getForecast, pointsAt } from '@/lib/openmeteo';
import { distanceKm } from '@/lib/optimizer';

export const runtime = 'nodejs';

/**
 * GET /api/advisory?city=pune&cell=<id>&at=<iso>&tempOffset=<°C>
 *
 * Drafts a plain-language advisory for one cell's neighbourhood.
 *
 * Cached per area per day per scenario. A judge clicking around during a demo
 * should not re-pay for the same text, and a cached advisory renders instantly
 * the second time — which is the difference between a feature that feels built
 * and one that feels like a spinner.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = getCity(url.searchParams.get('city'));
  const cellId = Number(url.searchParams.get('cell'));
  const at = url.searchParams.get('at') ? new Date(url.searchParams.get('at')!) : new Date();
  const tempOffset = Number(url.searchParams.get('tempOffset') ?? 0) || 0;

  if (!Number.isInteger(cellId)) {
    return NextResponse.json({ error: '`cell` must be a grid cell id' }, { status: 400 });
  }
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: 'Invalid `at` timestamp' }, { status: 400 });
  }
  if (Math.abs(tempOffset) > 20) {
    return NextResponse.json({ error: '`tempOffset` must be within ±20 °C' }, { status: 400 });
  }

  const [cell] = await db.select().from(gridCells).where(eq(gridCells.id, cellId)).limit(1);
  if (!cell || cell.city !== city.key) {
    return NextResponse.json({ error: 'No such cell in this city' }, { status: 404 });
  }

  const forecast = await getForecast(city).catch(() => null);
  if (!forecast || forecast.points.length === 0) {
    return NextResponse.json({ error: 'Forecast unavailable.' }, { status: 503 });
  }

  const slice = pointsAt(forecast.points, at);
  const regional =
    interpolate(
      cell.lat,
      cell.lng,
      slice.map((p) => ({ lat: p.lat, lng: p.lng, value: p.apparentC })),
    ) + tempOffset;
  const fused = fuse(regional, cell.heatProxy, cell.vulnerability);

  const validAt = slice[0]?.validAt ?? at;
  const name = await areaName(cell.lat, cell.lng, `Grid cell ${cell.row}/${cell.col}`);

  // Cache key: the cell, the calendar day it is valid for, and the scenario.
  //
  // Keyed on the cell id, not the area name. Several 1 km cells reverse-geocode
  // to the same suburb, so an area-name key served one cell's advisory for a
  // different cell — with numbers that visibly contradicted the panel directly
  // above it. The name is kept in the key only so the rows stay readable.
  const day = validAt.toISOString().slice(0, 10);
  const ward = `${name} #${cell.id} @${tempOffset}`;

  const [cached] = await db
    .select()
    .from(advisories)
    .where(
      and(eq(advisories.city, city.key), eq(advisories.ward, ward), eq(advisories.day, day)),
    )
    .limit(1);

  if (cached) {
    return NextResponse.json({
      area: name,
      body: cached.body,
      source: cached.source,
      cached: true,
      risk: round(fused.risk),
      validAt: validAt.toISOString(),
      simulated: tempOffset !== 0,
    });
  }

  const water = await db
    .select({ lat: facilities.lat, lng: facilities.lng })
    .from(facilities)
    .where(and(eq(facilities.city, city.key), eq(facilities.kind, 'water_point')));

  const nearest = water.reduce<number | null>((min, f) => {
    const d = distanceKm(cell, f);
    return min === null || d < min ? d : min;
  }, null);

  const input: AdvisoryInput = {
    cityName: city.name,
    areaName: name,
    risk: fused.risk,
    feelsLikeC: fused.feelsLikeC,
    regionalC: regional,
    population: cell.population,
    greenCover: cell.greenCover,
    validAt,
    simulated: tempOffset !== 0,
    // Beyond ~5 km the nearest water point is not meaningfully "near", and
    // saying so is more useful than quoting a large number.
    nearestReliefKm: nearest !== null && nearest <= 5 ? nearest : null,
  };

  const advisory = await generateAdvisory(input, process.env.GEMINI_API_KEY);

  await db
    .insert(advisories)
    .values({ city: city.key, ward, day, body: advisory.body, source: advisory.source })
    .onConflictDoNothing();

  return NextResponse.json({
    area: name,
    body: advisory.body,
    source: advisory.source,
    cached: false,
    risk: round(fused.risk),
    validAt: validAt.toISOString(),
    simulated: tempOffset !== 0,
  });
}

const round = (n: number) => Math.round(n * 10) / 10;
