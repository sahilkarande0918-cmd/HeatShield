import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { facilities } from '@/db/schema';
import { getCity } from '@/lib/cities';

export const runtime = 'nodejs';
export const revalidate = 3600; // OSM facilities change on a scale of months

/** GET /api/facilities?city=pune — hospitals, clinics and water points from OSM. */
export async function GET(req: Request) {
  const city = getCity(new URL(req.url).searchParams.get('city'));
  const rows = await db
    .select({
      id: facilities.id,
      kind: facilities.kind,
      name: facilities.name,
      lat: facilities.lat,
      lng: facilities.lng,
    })
    .from(facilities)
    .where(eq(facilities.city, city.key));

  return NextResponse.json({
    city: city.key,
    count: rows.length,
    byKind: rows.reduce<Record<string, number>>((a, r) => {
      a[r.kind] = (a[r.kind] ?? 0) + 1;
      return a;
    }, {}),
    facilities: rows,
  });
}
