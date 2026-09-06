export type City = {
  key: string;
  name: string;
  state: string;
  /** Map centre [lng, lat]. */
  center: [number, number];
  /** Grid + data extent [west, south, east, north]. */
  bbox: [number, number, number, number];
  /** Grid cell edge in degrees. ~0.009 deg is roughly 1 km at these latitudes. */
  cellSize: number;
  initialZoom: number;
  /** Municipal-corporation population, used to scale the dasymetric split. */
  population: number;
  populationSource: string;
  /** One line of why this city is in the demo. Shown in the city switcher. */
  note: string;
};

export const CITIES: Record<string, City> = {
  pune: {
    key: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    center: [73.8567, 18.5204],
    bbox: [73.72, 18.42, 74.0, 18.64],
    cellSize: 0.009,
    initialZoom: 11.2,
    population: 3_124_458,
    populationSource: 'Pune Municipal Corporation, Census of India 2011',
    note: 'Fast-growing, steep density gradient between the old city and the fringe.',
  },
  ahmedabad: {
    key: 'ahmedabad',
    name: 'Ahmedabad',
    state: 'Gujarat',
    center: [72.5714, 23.0225],
    bbox: [72.45, 22.93, 72.72, 23.15],
    cellSize: 0.009,
    initialZoom: 11.2,
    population: 5_577_940,
    populationSource: 'Ahmedabad Municipal Corporation, Census of India 2011',
    note: "India's first Heat Action Plan city, after the 2010 heatwave.",
  },
};

export const DEFAULT_CITY =
  CITIES[process.env.NEXT_PUBLIC_DEFAULT_CITY ?? 'pune'] ?? CITIES.pune;

export function getCity(key: string | null | undefined): City {
  return (key && CITIES[key]) || DEFAULT_CITY;
}
