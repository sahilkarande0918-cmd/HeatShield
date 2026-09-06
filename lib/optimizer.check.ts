/**
 * Self-check for the siting optimizer. Run: npm run check
 *
 * These assert the properties a municipal officer would be right to demand
 * before trusting the output, on inputs small enough to verify by hand.
 */
import assert from 'node:assert/strict';
import { type DemandCell, demandWeight, distanceKm, optimiseSites } from './optimizer';

const cell = (lat: number, lng: number, population: number, risk: number): DemandCell => ({
  lat,
  lng,
  population,
  risk,
});

// --- distance -------------------------------------------------------------
assert.equal(distanceKm({ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.8 }), 0);
{
  // One degree of latitude is ~110.6 km.
  const d = distanceKm({ lat: 18.0, lng: 73.8 }, { lat: 19.0, lng: 73.8 });
  assert.ok(Math.abs(d - 110.57) < 0.5, `1 deg lat should be ~110.6 km, got ${d}`);
}

// --- demand weighting -----------------------------------------------------
assert.equal(demandWeight(cell(0, 0, 1000, 40), 40), 0, 'a cell at the floor needs no relief');
assert.equal(demandWeight(cell(0, 0, 1000, 30), 40), 0, 'below the floor needs no relief');
assert.equal(demandWeight(cell(0, 0, 1000, 100), 40), 1000, 'a cell at 100 counts everyone');
assert.equal(demandWeight(cell(0, 0, 1000, 70), 40), 500, 'halfway up the range counts half');
// The point of the weighting: dense-and-safe must lose to sparse-and-cooking.
assert.ok(
  demandWeight(cell(0, 0, 100, 100), 40) > demandWeight(cell(0, 0, 900, 45), 40),
  'risk must be able to outweigh raw density',
);

// --- siting ---------------------------------------------------------------
{
  // Three hot clusters, far apart. Two of them are already served.
  const far = 0.05; // ~5.5 km apart, well outside a 1 km radius
  const cells = [
    cell(18.5, 73.8, 10_000, 90),
    cell(18.5 + far, 73.8, 5_000, 90),
    cell(18.5 + 2 * far, 73.8, 1_000, 90),
  ];
  const r = optimiseSites(cells, [], { k: 2, radiusKm: 1 });
  assert.equal(r.baselineCovered, 0, 'no existing facilities means no baseline coverage');
  assert.equal(r.sites.length, 2);
  // Greedy must take the biggest cluster first.
  assert.ok(distanceKm(r.sites[0], cells[0]) < 0.01, 'first site goes to the largest demand');
  assert.ok(distanceKm(r.sites[1], cells[1]) < 0.01, 'second site goes to the next largest');
  assert.ok(r.sites[0].gain > r.sites[1].gain, 'gains must be non-increasing');
  assert.equal(r.sites[1].cumulative, r.sites[0].gain + r.sites[1].gain, 'cumulative accumulates');
  assert.ok(r.proposedCovered > r.baselineCovered, 'adding sites must increase coverage');
  assert.ok(r.proposedCovered <= r.totalDemand, 'coverage can never exceed total demand');

  // Existing relief next to the biggest cluster should redirect the first pick.
  const withExisting = optimiseSites(cells, [{ lat: 18.5, lng: 73.8 }], { k: 1, radiusKm: 1 });
  assert.ok(withExisting.baselineCovered > 0, 'an existing facility covers demand');
  assert.ok(
    distanceKm(withExisting.sites[0], cells[1]) < 0.01,
    'a served cluster must not attract another site',
  );
}

{
  // Asking for more sites than there is demand must not invent useless ones.
  const cells = [cell(18.5, 73.8, 500, 80), cell(18.5, 73.81, 10, 10)];
  const r = optimiseSites(cells, [], { k: 6, radiusKm: 1 });
  assert.ok(r.sites.length < 6, 'stops once nothing is left to cover');
  assert.ok(r.sites.every((s) => s.gain > 0), 'never proposes a site that reaches nobody');
}

{
  // A city with no risk anywhere needs nothing. This is the honest-output case
  // for a mild day, and it must not fall over.
  const r = optimiseSites([cell(18.5, 73.8, 90_000, 5)], [], { k: 3 });
  assert.equal(r.totalDemand, 0);
  assert.equal(r.sites.length, 0, 'no risk means no recommendations');
}

console.log('Optimizer checks passed.');
