/**
 * Self-check for the risk model and the risk scale. Run: npm run check
 *
 * Deliberately assert-based and dependency-free — these are the properties
 * that must hold for the map to mean anything, not an exhaustive suite.
 */
import assert from 'node:assert/strict';
import { cellFeelsLikeC, exposureWeight, fuse, interpolate, thermalStress, UHI_MAX_C } from './fusion';
import { RISK_BANDS, riskBand, riskColor } from './risk';

// --- thermal stress -------------------------------------------------------
assert.equal(thermalStress(20), 0, 'no heat risk on a mild day');
assert.equal(thermalStress(27), 0, 'bottom of the caution band is still zero');
assert.equal(thermalStress(60), 100, 'above the published scale is capped at 100');
assert.equal(thermalStress(32), 25, 'caution/extreme-caution boundary');
assert.equal(thermalStress(41), 55, 'danger boundary');
assert.ok(thermalStress(36) > 25 && thermalStress(36) < 55, 'interpolates between bands');
// Monotonic: hotter is never scored safer.
for (let t = 15; t < 60; t += 0.5) {
  assert.ok(thermalStress(t + 0.5) >= thermalStress(t), `monotonic at ${t}`);
}

// --- urban heat island ----------------------------------------------------
assert.equal(cellFeelsLikeC(40, 0), 40, 'an unbuilt cell gets no UHI bump');
assert.equal(cellFeelsLikeC(40, 1), 40 + UHI_MAX_C, 'the densest cell gets the full bump');

// --- exposure weighting ---------------------------------------------------
assert.ok(exposureWeight(0) < 1, 'least vulnerable cell is damped');
assert.ok(exposureWeight(100) > 1, 'most vulnerable cell is amplified');
assert.ok(exposureWeight(0) < exposureWeight(50) && exposureWeight(50) < exposureWeight(100));

// --- fusion ---------------------------------------------------------------
// The property the whole product rests on: on a cool day the map goes quiet
// everywhere, however vulnerable the built environment is.
assert.equal(fuse(22, 1, 100).risk, 0, 'a cool day is not a heat emergency anywhere');
// And on a hot day, vulnerability is what separates cells.
const safe = fuse(38, 0, 5).risk;
const exposed = fuse(38, 1, 95).risk;
assert.ok(exposed > safe * 1.5, `vulnerable cells must separate: ${safe} vs ${exposed}`);
assert.ok(fuse(50, 1, 100).risk <= 100, 'risk is clamped to the scale');

// --- interpolation --------------------------------------------------------
const pts = [
  { lat: 0, lng: 0, value: 10 },
  { lat: 2, lng: 0, value: 20 },
];
assert.equal(interpolate(0, 0, pts), 10, 'sitting on a lattice point returns it exactly');
const mid = interpolate(1, 0, pts);
assert.ok(Math.abs(mid - 15) < 1e-9, `midpoint should be the mean, got ${mid}`);

// --- the risk scale -------------------------------------------------------
assert.equal(riskBand(0).key, 'low');
assert.equal(riskBand(19.9).key, 'low');
assert.equal(riskBand(20).key, 'moderate');
assert.equal(riskBand(100).key, 'extreme');
assert.equal(riskColor(85), RISK_BANDS[4].hex);
// The ramp must be monotonic in lightness, otherwise it stops working for
// colourblind viewers and in greyscale — the reason we picked it.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
for (let i = 1; i < RISK_BANDS.length; i++) {
  const prev = luminance(RISK_BANDS[i - 1].hex);
  const cur = luminance(RISK_BANDS[i].hex);
  assert.ok(cur > prev, `ramp must brighten monotonically at band ${RISK_BANDS[i].key}`);
}

console.log('All checks passed.');
