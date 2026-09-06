import { NextResponse } from 'next/server';
import { getCity } from '@/lib/cities';
import { getFacilities } from '@/lib/staticData';

export const runtime = 'nodejs';
export const revalidate = 3600; // OSM facilities change on a scale of months

/** GET /api/facilities?city=pune — hospitals, clinics and water points from OSM. */
export async function GET(req: Request) {
  const city = getCity(new URL(req.url).searchParams.get('city'));
  const all = await getFacilities(city);
  const rows = all.map((f) => ({
    id: f.id,
    kind: f.kind,
    name: f.name,
    lat: f.lat,
    lng: f.lng,
  }));

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
