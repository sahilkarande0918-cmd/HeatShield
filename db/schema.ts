import {
  doublePrecision,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * One ~1 km cell of a city. Everything static about the cell lives here:
 * it is computed offline by db/scripts/seed.ts and never recalculated at
 * request time. The live forecast is joined on top of it per request.
 */
export const gridCells = pgTable(
  'grid_cells',
  {
    id: serial('id').primaryKey(),
    city: text('city').notNull(),
    /** Cell centre. */
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    /** Integer grid coordinates, so neighbours are cheap to find. */
    row: integer('row').notNull(),
    col: integer('col').notNull(),

    // --- vulnerability components, each normalised 0-1 within the city ---
    /** Built-up intensity: OSM building footprint area per cell. */
    buildingDensity: real('building_density').notNull(),
    /** Share of the cell under OSM parks, forest, grass or scrub. */
    greenCover: real('green_cover').notNull(),
    /** Proximity to open water, which cools its surroundings. */
    waterProximity: real('water_proximity').notNull(),
    /**
     * Composite stand-in for satellite land-surface temperature, built from
     * the three above. Named "proxy" everywhere in the UI because that is
     * what it is — see the methodology note in the README.
     */
    heatProxy: real('heat_proxy').notNull(),

    /** People in this cell (dasymetric: residential floor area x city total). */
    population: integer('population').notNull(),
    /** Static vulnerability, 0-100. Heat proxy weighted by who is exposed. */
    vulnerability: real('vulnerability').notNull(),

    ward: text('ward'),
  },
  (t) => [
    uniqueIndex('grid_cells_city_row_col').on(t.city, t.row, t.col),
    index('grid_cells_city').on(t.city),
  ],
);

/** Hospitals and water points that already exist, from OSM. */
export const facilities = pgTable(
  'facilities',
  {
    id: serial('id').primaryKey(),
    city: text('city').notNull(),
    kind: text('kind').notNull(), // 'hospital' | 'water_point'
    name: text('name'),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
  },
  (t) => [index('facilities_city').on(t.city)],
);

/**
 * Cached Open-Meteo forecast. Fetched for a coarse lattice of points across
 * the city (not one citywide point) so the live layer varies across the map
 * too, and cached so a demo does not hammer the API or stall on it.
 */
export const forecasts = pgTable(
  'forecasts',
  {
    id: serial('id').primaryKey(),
    city: text('city').notNull(),
    /** Index into the city's forecast lattice. */
    point: integer('point').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    validAt: timestamp('valid_at', { withTimezone: true }).notNull(),
    tempC: real('temp_c').notNull(),
    humidity: real('humidity').notNull(),
    /** Open-Meteo apparent temperature — heat index, what the body feels. */
    apparentC: real('apparent_c').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('forecasts_city_point_valid').on(t.city, t.point, t.validAt),
    index('forecasts_city_valid').on(t.city, t.validAt),
  ],
);

/** Cached LLM advisories, one per ward per day, so the demo never re-pays. */
export const advisories = pgTable(
  'advisories',
  {
    id: serial('id').primaryKey(),
    city: text('city').notNull(),
    ward: text('ward').notNull(),
    /** YYYY-MM-DD the advisory is for. */
    day: text('day').notNull(),
    body: text('body').notNull(),
    /** 'gemini' or 'template' — the UI says which one produced the text. */
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('advisories_city_ward_day').on(t.city, t.ward, t.day)],
);

export type GridCell = typeof gridCells.$inferSelect;
export type Facility = typeof facilities.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
