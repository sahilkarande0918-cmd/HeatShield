/**
 * Where should the next cooling relief point go?
 *
 * This is the question the rest of the app exists to set up. It is a maximal
 * coverage location problem: given demand spread across the city, relief that
 * already exists, and a budget of k new sites, choose the k placements that
 * bring the most currently-unreached at-risk people within walking distance.
 *
 * Solved greedily. Maximal coverage is NP-hard, but greedy carries the classic
 * (1 - 1/e) ~ 63% approximation guarantee for monotone submodular objectives,
 * which coverage is — and, more to the point for a hackathon demo, it runs in
 * milliseconds and its output can be explained to a municipal officer one site
 * at a time: "this one reaches 41,000 people nobody currently reaches."
 *
 * Deliberately hand-written TypeScript. This is a small, well-understood
 * algorithm; standing up a Python service for it would buy nothing and cost a
 * second runtime in the deployment.
 */

const KM_PER_DEG_LAT = 110.57;
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

export type Point = { lat: number; lng: number };

export type DemandCell = Point & {
  /** People in the cell. */
  population: number;
  /** Fused risk score 0-100. */
  risk: number;
};

export type ProposedSite = Point & {
  rank: number;
  /** At-risk people this site reaches that nothing before it reached. */
  gain: number;
  /** Total at-risk people reached once this site is added. */
  cumulative: number;
};

export type SitingResult = {
  /** Total at-risk demand across the city. */
  totalDemand: number;
  /** At-risk demand already within reach of existing facilities. */
  baselineCovered: number;
  /** At-risk demand covered once every proposed site is added. */
  proposedCovered: number;
  sites: ProposedSite[];
  radiusKm: number;
  riskFloor: number;
};

/**
 * Demand weight for a cell.
 *
 * Relief is not for everybody, it is for the people actually in danger, so a
 * cell contributes population scaled by how far its risk sits above `floor`.
 * A cell at the floor contributes nothing; one at 100 contributes everyone.
 * Without this the optimizer just finds the densest cells, which is a
 * population map, not a heat-risk map.
 */
export function demandWeight(cell: DemandCell, floor: number): number {
  if (cell.risk <= floor) return 0;
  return cell.population * ((cell.risk - floor) / (100 - floor));
}

export function distanceKm(a: Point, b: Point): number {
  const dx = (a.lng - b.lng) * kmPerDegLng((a.lat + b.lat) / 2);
  const dy = (a.lat - b.lat) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

export type SitingOptions = {
  /**
   * How far someone will walk to relief. Deliberately short: in a 45 °C
   * afternoon the people most at risk — the elderly, outdoor workers at the end
   * of a shift, small children — are not walking two kilometres to a water
   * point. 1 km is roughly a 15-minute walk in that heat.
   */
  radiusKm?: number;
  /** Risk score below which a cell is not considered to need relief. */
  riskFloor?: number;
  /** How many new sites to propose. */
  k?: number;
};

export function optimiseSites(
  cells: DemandCell[],
  existing: Point[],
  opts: SitingOptions = {},
): SitingResult {
  const radiusKm = opts.radiusKm ?? 1.0;
  const riskFloor = opts.riskFloor ?? 40;
  const k = Math.max(0, Math.min(20, opts.k ?? 5));

  const weights = cells.map((c) => demandWeight(c, riskFloor));
  const totalDemand = weights.reduce((a, b) => a + b, 0);

  // Demand already reached by a hospital, clinic or water point.
  const covered = new Array<boolean>(cells.length).fill(false);
  for (let i = 0; i < cells.length; i++) {
    if (weights[i] <= 0) continue;
    for (const f of existing) {
      if (distanceKm(cells[i], f) <= radiusKm) {
        covered[i] = true;
        break;
      }
    }
  }
  const baselineCovered = weights.reduce((a, w, i) => a + (covered[i] ? w : 0), 0);

  // Candidate sites are the cell centres themselves. At ~1 km spacing that is
  // a fine enough lattice for a placement recommendation, and it guarantees
  // every proposal sits somewhere the city actually is.
  const candidates = cells.filter((c) => c.population > 0);

  // Precompute which demand cells each candidate would reach. 744 x 744 is
  // half a million cheap comparisons — well under a frame.
  const reach: number[][] = candidates.map((cand) => {
    const hit: number[] = [];
    for (let i = 0; i < cells.length; i++) {
      if (weights[i] > 0 && distanceKm(cand, cells[i]) <= radiusKm) hit.push(i);
    }
    return hit;
  });

  const sites: ProposedSite[] = [];
  const used = new Set<number>();
  let cumulative = baselineCovered;

  for (let round = 0; round < k; round++) {
    let best = -1;
    let bestGain = 0;
    for (let c = 0; c < candidates.length; c++) {
      if (used.has(c)) continue;
      let gain = 0;
      for (const i of reach[c]) if (!covered[i]) gain += weights[i];
      if (gain > bestGain) {
        bestGain = gain;
        best = c;
      }
    }
    // Nothing left worth covering: stop rather than pad the list with sites
    // that reach nobody. Honest output beats a full-looking one.
    if (best < 0 || bestGain <= 0) break;

    for (const i of reach[best]) covered[i] = true;
    used.add(best);
    cumulative += bestGain;
    sites.push({
      lat: candidates[best].lat,
      lng: candidates[best].lng,
      rank: sites.length + 1,
      gain: Math.round(bestGain),
      cumulative: Math.round(cumulative),
    });
  }

  return {
    totalDemand: Math.round(totalDemand),
    baselineCovered: Math.round(baselineCovered),
    proposedCovered: Math.round(cumulative),
    sites,
    radiusKm,
    riskFloor,
  };
}
