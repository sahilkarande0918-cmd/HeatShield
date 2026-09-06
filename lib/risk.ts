/**
 * The risk scale. This is the one place the 0-100 score is turned into a
 * colour, a name or a band — the hero shader, the map fill, the legend, the
 * stat cards and the advisory prompt all read from here so they can never
 * drift apart.
 *
 * The ramp is Inferno-derived and monotonic in lightness. That is deliberate:
 * the conventional green-to-red heat ramp collapses for red-green colourblind
 * viewers and in greyscale print, which is exactly the audience a municipal
 * heat map cannot afford to lose. Hex values mirror the OKLCH tokens in
 * app/globals.css (MapLibre cannot read CSS custom properties).
 */

export type RiskBand = {
  key: 'low' | 'moderate' | 'high' | 'severe' | 'extreme';
  label: string;
  /** Lower bound of the band, inclusive. */
  min: number;
  hex: string;
  cssVar: string;
  /** Plain-language consequence, used in advisories and map popups. */
  meaning: string;
};

export const RISK_BANDS: RiskBand[] = [
  {
    key: 'low',
    label: 'Low',
    min: 0,
    hex: '#372c68',
    cssVar: 'var(--risk-0)',
    meaning: 'Normal precautions. No additional relief needed.',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    min: 20,
    hex: '#8a2681',
    cssVar: 'var(--risk-1)',
    meaning: 'Outdoor workers should take shade breaks through the afternoon.',
  },
  {
    key: 'high',
    label: 'High',
    min: 40,
    hex: '#d32d48',
    cssVar: 'var(--risk-2)',
    meaning: 'Heat illness likely for the elderly, infants and outdoor workers.',
  },
  {
    key: 'severe',
    label: 'Severe',
    min: 60,
    hex: '#f77a00',
    cssVar: 'var(--risk-3)',
    meaning: 'Relief centres should open. Restrict outdoor work 12:00-16:00.',
  },
  {
    key: 'extreme',
    label: 'Extreme',
    min: 80,
    hex: '#f6d32b',
    cssVar: 'var(--risk-4)',
    meaning: 'Emergency response. Heatstroke risk across the whole population.',
  },
];

export function riskBand(score: number): RiskBand {
  let band = RISK_BANDS[0];
  for (const b of RISK_BANDS) if (score >= b.min) band = b;
  return band;
}

export function riskColor(score: number): string {
  return riskBand(score).hex;
}

/** MapLibre `interpolate` stop pairs, so the map ramps continuously. */
export const RISK_STOPS: (number | string)[] = RISK_BANDS.flatMap((b) => [b.min, b.hex]);

export function clampScore(n: number): number {
  return Math.min(100, Math.max(0, n));
}
