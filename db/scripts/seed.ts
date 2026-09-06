/**
 * One-time offline seed of the static vulnerability layer.
 *
 * METHODOLOGY (read this before quoting any number from the app)
 * --------------------------------------------------------------
 * This is a *heat proxy*, not satellite land-surface temperature. Real LST
 * needs Google Earth Engine, which needs a signup we deliberately avoided.
 * Everything below is derived from OpenStreetMap plus one Census of India
 * total per city, all free and all fetchable without a key.
 *
 *   building_density  count of OSM building footprints per cell
 *   green_cover       share of the cell under parks / forest / grass / scrub
 *   water_proximity   exponential decay of distance to nearest open water
 *   heat_proxy        0.55*built + 0.30*(1-green) + 0.15*(1-water), renormalised
 *   population        city Census total split across cells in proportion to
 *                     building count (standard dasymetric redistribution)
 *   vulnerability     0.65*heat_proxy + 0.35*population density, scaled 0-100
 *
 * Components are stored separately so the UI can show *why* a cell scores
 * what it does, and so a real LST column can replace heat_proxy later without
 * touching anything downstream.
 *
 * Run:  npm run seed              (all cities)
 *       npm run seed -- pune      (one city)
 *       npm run seed -- pune --dry (fetch + score only, no database)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { eq } from 'drizzle-orm';
import { facilities, gridCells } from '../schema';
import { CITIES, type City } from '../../lib/cities';
import { bboxStr, elementCenter, overpass, tiles, type OsmElement } from './overpass';

type Cell = {
  row: number;
  col: number;
  lat: number;
  lng: number;
  west: number;
  south: number;
  east: number;
  north: number;
  buildings: number;
  greenAreaKm2: number;
  waterDistKm: number;
};

const KM_PER_DEG_LAT = 110.57;
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

function buildGrid(city: City): { cells: Cell[]; rows: number; cols: number } {
  const [w, s, e, n] = city.bbox;
  const size = city.cellSize;
  const cols = Math.round((e - w) / size);
  const rows = Math.round((n - s) / size);
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const west = w + col * size;
      const south = s + row * size;
      cells.push({
        row,
        col,
        lat: south + size / 2,
        lng: west + size / 2,
        west,
        south,
        east: west + size,
        north: south + size,
        buildings: 0,
        greenAreaKm2: 0,
        waterDistKm: Infinity,
      });
    }
  }
  return { cells, rows, cols };
}

function cellIndexer(city: City, cells: Cell[], rows: number, cols: number) {
  const [w, s] = city.bbox;
  const size = city.cellSize;
  return (lat: number, lon: number): Cell | null => {
    const col = Math.floor((lon - w) / size);
    const row = Math.floor((lat - s) / size);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return cells[row * cols + col] ?? null;
  };
}

/**
 * Percentile rank within the city, not min-max.
 *
 * This matters more than it looks. Building counts and populations are heavily
 * right-skewed, so min-max (even on log values, even with outlier clipping)
 * pushes the median cell to ~0.8 and paints the entire city one shade of
 * "severe" — which is precisely the failure this project exists to fix. Rank
 * gives a flat 0-1 spread, so the genuinely dangerous pockets separate visibly
 * from the ordinary ones. The trade-off is that the static layer is explicitly
 * *relative to this city*; absolute danger enters in Phase 3 via the forecast.
 */
function rank01(values: number[]): number[] {
  const order = values
    .map((v, i) => [v, i] as const)
    .sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  const n = values.length;
  let i = 0;
  while (i < n) {
    // Ties share the mid-rank, so a run of identical zeros does not get an
    // arbitrary internal ordering.
    let j = i;
    while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
    const mid = n > 1 ? (i + j) / 2 / (n - 1) : 0;
    for (let k = i; k <= j; k++) out[order[k][1]] = mid;
    i = j + 1;
  }
  return out;
}

async function fetchBuildings(city: City, index: (lat: number, lon: number) => Cell | null) {
  const ts = tiles(city.bbox, 0.05);
  let total = 0;
  for (const [i, t] of ts.entries()) {
    const els = await overpass(
      `[out:json][timeout:180];nwr["building"](${bboxStr(t)});out ids center;`,
      `${city.key}-buildings-${i}`,
    );
    for (const el of els) {
      const c = elementCenter(el);
      if (!c) continue;
      const cell = index(c.lat, c.lon);
      if (cell) cell.buildings++;
    }
    total += els.length;
    process.stdout.write(`\r  buildings: tile ${i + 1}/${ts.length}, ${total} found    `);
  }
  process.stdout.write('\n');
}

/**
 * Green and water come back as bounding boxes rather than full geometry — far
 * lighter on a shared Overpass instance, and at 1 km resolution the bbox is
 * close enough. SHAPE_FACTOR discounts it toward the real polygon area.
 */
const SHAPE_FACTOR = 0.62;

async function fetchAreas(city: City, cells: Cell[]) {
  const bb = bboxStr(city.bbox);
  const green = await overpass(
    `[out:json][timeout:180];(` +
      `way["leisure"~"^(park|garden|nature_reserve)$"](${bb});` +
      `way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|orchard)$"](${bb});` +
      `way["natural"~"^(wood|scrub|grassland)$"](${bb});` +
      `);out bb;`,
    `${city.key}-green`,
  );

  const cellAreaKm2 =
    city.cellSize * KM_PER_DEG_LAT * (city.cellSize * kmPerDegLng(city.center[1]));

  for (const el of green) {
    if (!el.bounds) continue;
    const { minlat, minlon, maxlat, maxlon } = el.bounds;
    for (const cell of cells) {
      const ow = Math.min(maxlon, cell.east) - Math.max(minlon, cell.west);
      const oh = Math.min(maxlat, cell.north) - Math.max(minlat, cell.south);
      if (ow <= 0 || oh <= 0) continue;
      cell.greenAreaKm2 += ow * kmPerDegLng(cell.lat) * oh * KM_PER_DEG_LAT * SHAPE_FACTOR;
    }
  }
  for (const cell of cells) cell.greenAreaKm2 = Math.min(cell.greenAreaKm2, cellAreaKm2);

  const water = await overpass(
    `[out:json][timeout:180];(` +
      `way["natural"="water"](${bb});` +
      `way["waterway"~"^(riverbank|river)$"](${bb});` +
      `relation["natural"="water"](${bb});` +
      `);out bb;`,
    `${city.key}-water`,
  );

  for (const el of water) {
    const c = el.bounds
      ? {
          lat: (el.bounds.minlat + el.bounds.maxlat) / 2,
          lon: (el.bounds.minlon + el.bounds.maxlon) / 2,
        }
      : elementCenter(el);
    if (!c) continue;
    for (const cell of cells) {
      const dx = (cell.lng - c.lon) * kmPerDegLng(cell.lat);
      const dy = (cell.lat - c.lat) * KM_PER_DEG_LAT;
      const d = Math.hypot(dx, dy);
      if (d < cell.waterDistKm) cell.waterDistKm = d;
    }
  }

  console.log(`  green polygons: ${green.length}, water bodies: ${water.length}`);
  return cellAreaKm2;
}

async function fetchFacilities(city: City) {
  const bb = bboxStr(city.bbox);
  const hospitals = await overpass(
    `[out:json][timeout:180];nwr["amenity"~"^(hospital|clinic)$"](${bb});out center tags;`,
    `${city.key}-hospitals`,
  );
  const points = await overpass(
    `[out:json][timeout:180];(` +
      `nwr["amenity"="drinking_water"](${bb});` +
      `nwr["man_made"="water_tap"](${bb});` +
      `nwr["amenity"="water_point"](${bb});` +
      `);out center tags;`,
    `${city.key}-waterpoints`,
  );

  const rows: (typeof facilities.$inferInsert)[] = [];
  const push = (el: OsmElement, kind: string) => {
    const c = elementCenter(el);
    if (!c) return;
    rows.push({ city: city.key, kind, name: el.tags?.name ?? null, lat: c.lat, lng: c.lon });
  };
  hospitals.forEach((e) => push(e, 'hospital'));
  points.forEach((e) => push(e, 'water_point'));
  console.log(`  facilities: ${hospitals.length} hospitals/clinics, ${points.length} water points`);
  return rows;
}

async function seedCity(city: City) {
  console.log(`\n${city.name}`);
  const { cells, rows: gr, cols: gc } = buildGrid(city);
  console.log(`  grid: ${gc} x ${gr} = ${cells.length} cells at ${city.cellSize} deg (~1 km)`);

  await fetchBuildings(city, cellIndexer(city, cells, gr, gc));
  const cellAreaKm2 = await fetchAreas(city, cells);
  const facilityRows = await fetchFacilities(city);

  // --- composite scores -----------------------------------------------------
  // log1p on the count: the difference between 5 and 50 buildings matters far
  // more than the difference between 2000 and 2045.
  const built = rank01(cells.map((c) => c.buildings));
  const green = cells.map((c) => Math.min(1, c.greenAreaKm2 / cellAreaKm2));
  // 1.5 km e-folding — the cooling influence of a water body is local.
  const water = cells.map((c) =>
    Number.isFinite(c.waterDistKm) ? Math.exp(-c.waterDistKm / 1.5) : 0,
  );

  const heat = rank01(
    cells.map((_, i) => 0.55 * built[i] + 0.3 * (1 - green[i]) + 0.15 * (1 - water[i])),
  );

  const buildingTotal = cells.reduce((a, c) => a + c.buildings, 0) || 1;
  const population = cells.map((c) => Math.round((c.buildings / buildingTotal) * city.population));
  const popDensity = rank01(population);

  const rows = cells.map((c, i) => ({
    city: city.key,
    lat: c.lat,
    lng: c.lng,
    row: c.row,
    col: c.col,
    buildingDensity: built[i],
    greenCover: green[i],
    waterProximity: water[i],
    heatProxy: heat[i],
    population: population[i],
    vulnerability: 100 * (0.65 * heat[i] + 0.35 * popDensity[i]),
    ward: null,
  }));

  const top = [...rows].sort((a, b) => b.vulnerability - a.vulnerability)[0];
  const q = (p: number) => {
    const s2 = rows.map((r) => r.vulnerability).sort((a, b) => a - b);
    return s2[Math.floor(s2.length * p)].toFixed(0);
  };
  console.log(`  score spread p10/p50/p90: ${q(0.1)} / ${q(0.5)} / ${q(0.9)}`);
  const summary =
    `  most vulnerable cell ${top.lat.toFixed(3)},${top.lng.toFixed(3)} scores ` +
    `${top.vulnerability.toFixed(1)} with ${top.population.toLocaleString('en-IN')} people; ` +
    `median score ${median(rows.map((r) => r.vulnerability)).toFixed(1)}`;

  if (DRY) {
    console.log(`  [dry run] would write ${rows.length} cells, ${facilityRows.length} facilities`);
    console.log(summary);
    return;
  }

  const { db } = await import('../index');
  await db.delete(gridCells).where(eq(gridCells.city, city.key));
  await db.delete(facilities).where(eq(facilities.city, city.key));
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(gridCells).values(rows.slice(i, i + 500));
  }
  for (let i = 0; i < facilityRows.length; i += 500) {
    await db.insert(facilities).values(facilityRows.slice(i, i + 500));
  }

  console.log(`  seeded ${rows.length} cells and ${facilityRows.length} facilities`);
  console.log(summary);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

const DRY = process.argv.includes('--dry');

async function main() {
  const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const list = only ? [CITIES[only]] : Object.values(CITIES);
  if (list.some((c) => !c)) {
    throw new Error(`Unknown city "${only}". Known: ${Object.keys(CITIES).join(', ')}`);
  }
  for (const city of list) await seedCity(city);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
