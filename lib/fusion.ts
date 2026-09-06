/**
 * Turning a static vulnerability layer plus a live forecast into today's risk.
 *
 * This is the step that makes HeatShield a forecast rather than an atlas, so
 * it is written to be explainable in three sentences:
 *
 *   1. The forecast is a regional number. A dense, unshaded block runs hotter
 *      than the met station, so each cell gets an urban-heat-island offset
 *      proportional to its heat proxy.
 *   2. That cell-level "feels like" temperature is scored against the standard
 *      heat-index danger bands, giving thermal stress 0-100.
 *   3. Stress is then weighted by who is exposed — the same 45 °C is a worse
 *      emergency in a dense cell full of people than on an empty ridge.
 *
 * Everything here is pure and deterministic; see lib/fusion.check.ts.
 */

import { clampScore } from './risk';

/**
 * Peak urban-heat-island intensity, °C, applied to the most built-up cell.
 * Measured UHI in large Indian cities typically runs 2-5 °C above the
 * surrounding rural reference on a clear summer afternoon; 4 is a mid estimate.
 * This is the single most load-bearing assumption in the model — if you get
 * real land-surface temperature later, this constant is what it replaces.
 */
export const UHI_MAX_C = 4.0;

/**
 * Heat-index danger bands (NOAA/NWS), used as the stress scale. Below 27 °C
 * apparent temperature there is no meaningful heat risk; 54 °C and above is
 * the top of the published scale.
 */
const STRESS_POINTS: [apparentC: number, score: number][] = [
  [27, 0], // no risk
  [32, 25], // caution
  [41, 55], // danger
  [54, 100], // extreme danger
];

/** Piecewise-linear heat stress, 0-100, from an apparent temperature in °C. */
export function thermalStress(apparentC: number): number {
  const p = STRESS_POINTS;
  if (apparentC <= p[0][0]) return 0;
  if (apparentC >= p[p.length - 1][0]) return 100;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    if (apparentC <= x1) return y0 + ((apparentC - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 100;
}

/** What this specific cell feels like, given the regional apparent temperature. */
export function cellFeelsLikeC(regionalApparentC: number, heatProxy: number): number {
  return regionalApparentC + UHI_MAX_C * heatProxy;
}

/**
 * Exposure weighting. A cell at the bottom of the vulnerability distribution
 * is scored at 0.7x the raw thermal stress, one at the top at 1.3x, so the
 * ranking is driven by heat first and by who is under it second.
 */
export function exposureWeight(vulnerability: number): number {
  return 0.7 + 0.6 * (clampScore(vulnerability) / 100);
}

export type FusedCell = {
  feelsLikeC: number;
  stress: number;
  risk: number;
};

export function fuse(
  regionalApparentC: number,
  heatProxy: number,
  vulnerability: number,
): FusedCell {
  const feelsLikeC = cellFeelsLikeC(regionalApparentC, heatProxy);
  const stress = thermalStress(feelsLikeC);
  return {
    feelsLikeC,
    stress,
    risk: clampScore(stress * exposureWeight(vulnerability)),
  };
}

/**
 * Inverse-distance interpolation from the forecast lattice to a cell centre.
 * Open-Meteo is queried at a coarse grid of points across the city rather than
 * one central point, so the live layer varies across the map too.
 */
export function interpolate(
  lat: number,
  lng: number,
  points: { lat: number; lng: number; value: number }[],
): number {
  if (points.length === 0) return NaN;
  let num = 0;
  let den = 0;
  for (const p of points) {
    const d2 = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d2 < 1e-12) return p.value; // sitting on a lattice point
    const w = 1 / d2;
    num += w * p.value;
    den += w;
  }
  return num / den;
}
