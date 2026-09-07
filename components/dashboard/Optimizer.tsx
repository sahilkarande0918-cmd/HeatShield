'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SiteMarker } from '@/components/RiskMap';

export type OptimizeResult = {
  totalDemand: number;
  baselineCovered: number;
  proposedCovered: number;
  baselineShare: number | null;
  proposedShare: number | null;
  radiusKm: number;
  existingCount: number;
  byKind: Record<string, number>;
  computeMs: number;
  simulated: boolean;
  sites: SiteMarker[];
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

export function useOptimizer(
  city: string,
  at: Date | null,
  tempOffset: number,
  sites: number,
  countHospitals: boolean,
) {
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const iso = at?.toISOString() ?? null;
  const key = iso === null ? null : `${city}|${iso}|${tempOffset}|${sites}|${countHospitals}`;
  const [settled, setSettled] = useState<string | null>(null);
  const loading = key !== null && settled !== key;

  const run = useCallback(async () => {
    if (iso === null || key === null) return;
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const counts = countHospitals ? 'water_point,hospital' : 'water_point';
    try {
      const res = await fetch(
        `/api/optimize?city=${city}&at=${encodeURIComponent(iso)}&tempOffset=${tempOffset}` +
          `&sites=${sites}&counts=${counts}`,
        { signal: ctrl.signal },
      );
      const json = await res.json();
      if (ctrl.signal.aborted) return;
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setResult(json);
      setError(null);
      setSettled(key);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setSettled(key);
    }
  }, [city, iso, key, tempOffset, sites, countHospitals]);

  useEffect(() => {
    // See useRiskData: every setState in `run` happens after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
    return () => inflight.current?.abort();
  }, [run]);

  return { result, error, loading };
}

export default function Optimizer({
  result,
  loading,
  error,
  sites,
  setSites,
  countHospitals,
  setCountHospitals,
}: {
  result: OptimizeResult | null;
  loading: boolean;
  error: string | null;
  sites: number;
  setSites: (n: number) => void;
  countHospitals: boolean;
  setCountHospitals: (b: boolean) => void;
}) {
  const gain = result ? result.proposedCovered - result.baselineCovered : null;
  const nothingAtRisk = result !== null && result.totalDemand === 0;

  return (
    <section className="border-t border-hairline p-lg">
      <h2 className="text-xl font-semibold">Where the relief should go</h2>

      {/* Chrome, not data: a failed request is not a heat risk. */}
      {error && <p className="mt-sm text-sm text-ink">{error}</p>}

      {nothingAtRisk ? (
        <p className="mt-sm text-sm text-ink-2">
          Nobody in the mapped area is above the relief threshold at this hour, so there is nothing
          to site. Try a later hour or a heatwave scenario.
        </p>
      ) : (
        <>
          <p className="tabular mt-lg text-xs uppercase tracking-[0.2em] text-ink-3">
            {sites} new relief {sites === 1 ? 'point' : 'points'} would reach
          </p>
          <p
            className="tabular mt-2xs text-[clamp(1.75rem,5vw,2.5rem)] leading-none"
            style={{ color: 'var(--color-accent)' }}
          >
            {/* No number until the optimizer has actually answered. */}
            {gain === null ? (loading ? '—' : 'no data') : `+${fmt(gain)}`}
          </p>
          <p className="mt-xs text-sm text-ink-2">
            more at-risk people than today&rsquo;s relief reaches, within a{' '}
            {result?.radiusKm ?? 1} km walk.
          </p>

          <CoverageBar result={result} />

          <label htmlFor="sites" className="tabular mt-lg block text-xs uppercase tracking-[0.2em] text-ink-3">
            Budget — {sites} {sites === 1 ? 'site' : 'sites'}
          </label>
          <input
            id="sites"
            type="range"
            min={1}
            max={10}
            step={1}
            value={sites}
            onChange={(e) => setSites(Number(e.target.value))}
            className="mt-sm h-[24px] w-full accent-[var(--color-accent)]"
          />

          {result && result.sites.length > 0 && (
            <ol className="mt-lg flex flex-col gap-xs">
              {result.sites.map((s) => (
                <li
                  key={s.rank}
                  className="tabular flex items-baseline justify-between gap-md border-b border-hairline pb-xs text-sm"
                >
                  <span className="text-ink-3">
                    #{s.rank} &nbsp;{s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                  </span>
                  <span className="whitespace-nowrap text-ink">+{fmt(s.gain)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <label className="mt-lg flex cursor-pointer items-start gap-sm text-sm">
        <input
          type="checkbox"
          checked={countHospitals}
          onChange={(e) => setCountHospitals(e.target.checked)}
          className="mt-[3px] accent-[var(--color-accent)]"
        />
        <span className="text-ink-2">
          Count hospitals as existing relief
          <span className="mt-2xs block text-xs text-ink-3">
            Off by default. A hospital is where somebody goes after heatstroke, not somewhere they
            go to avoid it. With it off, {result?.byKind?.water_point ?? '—'} mapped public water
            points are all this city has.
          </span>
        </span>
      </label>

      {result && (
        <p className="tabular mt-lg text-xs text-ink-3">
          Greedy maximal coverage over {fmt(result.totalDemand)} weighted at-risk people, solved in{' '}
          {result.computeMs} ms.
        </p>
      )}
    </section>
  );
}

function CoverageBar({ result }: { result: OptimizeResult | null }) {
  const base = result?.baselineShare ?? 0;
  const prop = result?.proposedShare ?? 0;
  return (
    <div className="mt-lg">
      <div className="relative h-[10px] w-full overflow-hidden rounded-pill bg-paper-3">
        <div
          className="absolute inset-y-0 left-0 rounded-pill bg-accent/35"
          style={{ width: `${prop * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-pill bg-ink-3"
          style={{ width: `${base * 100}%` }}
        />
      </div>
      <div className="tabular mt-xs flex justify-between text-xs">
        <span className="text-ink-3">Today {pct(result?.baselineShare ?? null)}</span>
        <span style={{ color: 'var(--color-accent)' }}>
          Recommended {pct(result?.proposedShare ?? null)}
        </span>
      </div>
    </div>
  );
}
