'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import RiskMap, { type CellProps, type SiteMarker } from '@/components/RiskMap';
import CellDetail from './CellDetail';
import Optimizer, { useOptimizer } from './Optimizer';
import { useFacilities, useRiskSurface } from './useRiskData';
import { CITIES, getCity } from '@/lib/cities';
import { RISK_BANDS } from '@/lib/risk';

/** Discrete, honestly-labelled scenarios rather than a free slider. */
const SCENARIOS = [
  { offset: 0, label: 'Live', hint: 'Actual Open-Meteo forecast' },
  { offset: 6, label: '+6 °C', hint: 'A hot pre-monsoon week' },
  { offset: 12, label: '+12 °C', hint: 'A May heatwave for this city' },
];

const fmt = (n: number) => n.toLocaleString('en-IN');

export default function Dashboard({ initialCity }: { initialCity: string }) {
  const [cityKey, setCityKey] = useState(initialCity);
  const [hoursAhead, setHoursAhead] = useState(0);
  const [tempOffset, setTempOffset] = useState(0);
  const [selected, setSelected] = useState<CellProps | null>(null);
  const [showFacilities, setShowFacilities] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [siteBudget, setSiteBudget] = useState(5);
  const [countHospitals, setCountHospitals] = useState(false);

  const city = getCity(cityKey);
  // Pinned at hydration rather than read during render: Date.now() in render is
  // impure and makes the server and client markup disagree.
  const bootMs = useBootTime();
  const at = useMemo(
    () => (bootMs === null ? null : new Date(bootMs + hoursAhead * 3600_000)),
    [bootMs, hoursAhead],
  );
  const { data, meta, error, loading, reload } = useRiskSurface(cityKey, at, tempOffset);
  const facilities = useFacilities(cityKey);
  const opt = useOptimizer(cityKey, at, tempOffset, siteBudget, countHospitals);
  const proposed: SiteMarker[] = opt.result?.sites ?? [];

  return (
    <div className="flex h-[100svh] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-md border-b border-hairline px-lg py-sm">
        <div className="flex items-center gap-lg">
          <Link
            href="/"
            className="tabular text-xs uppercase tracking-[0.22em] text-ink-2 transition-colors duration-[var(--dur-fast)] hover:text-ink"
          >
            ← HeatShield
          </Link>
          <div className="flex gap-2xs" role="group" aria-label="City">
            {Object.values(CITIES).map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  setCityKey(c.key);
                  setSelected(null);
                }}
                title={c.note}
                aria-pressed={c.key === cityKey}
                className={`rounded-pill px-sm py-2xs text-sm transition-colors duration-[var(--dur-fast)] ${
                  c.key === cityKey
                    ? 'bg-paper-3 text-ink'
                    : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-sm">
          <StatusPill meta={meta} loading={loading} error={error} />
          <button
            onClick={() => {
              setSelected(null);
              setResetToken((t) => t + 1);
            }}
            className="tabular rounded-pill border border-hairline px-sm py-2xs text-xs uppercase tracking-[0.14em] text-ink-3 transition-colors duration-[var(--dur-fast)] hover:text-ink"
          >
            Reset view
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative min-h-[46svh] flex-1">
          <RiskMap
            city={city}
            cells={data}
            facilities={facilities}
            proposed={proposed}
            showFacilities={showFacilities}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            resetToken={resetToken}
          />

          {error && (
            <div className="absolute inset-x-lg top-lg z-10 rounded-md border border-hairline bg-paper-2 p-lg">
              <p className="font-medium text-risk-2">Could not load the risk surface</p>
              <p className="mt-xs text-sm text-ink-2">{error}</p>
              <button
                onClick={() => void reload()}
                className="mt-md rounded-pill bg-accent px-md py-2xs text-sm text-accent-ink"
              >
                Try again
              </button>
            </div>
          )}

          <Legend />
        </div>

        <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-hairline bg-paper-2 lg:w-[380px] lg:border-t-0 lg:border-l">
          {selected ? (
            <CellDetail cell={selected} onClose={() => setSelected(null)} />
          ) : (
            <Summary
              meta={meta}
              loading={loading}
              hoursAhead={hoursAhead}
              setHoursAhead={setHoursAhead}
              bootMs={bootMs}
              tempOffset={tempOffset}
              setTempOffset={setTempOffset}
              showFacilities={showFacilities}
              setShowFacilities={setShowFacilities}
              facilityCount={facilities.length}
            />
          )}

          <Optimizer
            result={opt.result}
            loading={opt.loading}
            error={opt.error}
            sites={siteBudget}
            setSites={setSiteBudget}
            countHospitals={countHospitals}
            setCountHospitals={setCountHospitals}
          />
        </aside>
      </div>
    </div>
  );
}

function StatusPill({
  meta,
  loading,
  error,
}: {
  meta: ReturnType<typeof useRiskSurface>['meta'];
  loading: boolean;
  error: string | null;
}) {
  if (error) return <Pill tone="var(--color-risk-2)">Offline</Pill>;
  if (loading && !meta) return <Pill tone="var(--color-ink-3)">Loading…</Pill>;
  if (!meta) return null;
  if (meta.simulated) return <Pill tone="var(--color-focus)">Simulated +{meta.tempOffset} °C</Pill>;
  if (meta.forecastStale) return <Pill tone="var(--color-risk-3)">Cached forecast</Pill>;
  return <Pill tone="var(--color-risk-3)">Live · {meta.source}</Pill>;
}

function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className="tabular rounded-pill px-sm py-2xs text-xs uppercase tracking-[0.14em]"
      style={{ color: tone, border: `1px solid ${tone}`, opacity: 0.9 }}
    >
      {children}
    </span>
  );
}

function Summary({
  meta,
  loading,
  hoursAhead,
  setHoursAhead,
  bootMs,
  tempOffset,
  setTempOffset,
  showFacilities,
  setShowFacilities,
  facilityCount,
}: {
  meta: ReturnType<typeof useRiskSurface>['meta'];
  loading: boolean;
  hoursAhead: number;
  setHoursAhead: (n: number) => void;
  bootMs: number | null;
  tempOffset: number;
  setTempOffset: (n: number) => void;
  showFacilities: boolean;
  setShowFacilities: (b: boolean) => void;
  facilityCount: number;
}) {
  const whenLabel =
    bootMs === null
      ? null
      : new Date(bootMs + hoursAhead * 3600_000).toLocaleString('en-IN', {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata',
        });

  return (
    <div className="flex flex-col gap-lg p-lg">
      <div>
        <p className="tabular text-xs uppercase tracking-[0.2em] text-ink-3">People at risk now</p>
        {/* Honest empty state: no number until real data has arrived. */}
        {/* Indian digit grouping makes this string long (22,51,827): size it
            to the panel, not to the display scale. */}
        <p className="tabular mt-2xs text-[clamp(1.75rem,5vw,2.5rem)] leading-none">
          {meta ? fmt(meta.populationAtRisk) : loading ? '—' : 'no data'}
        </p>
        <p className="mt-xs text-sm text-ink-2">
          {meta
            ? `of ${fmt(meta.totalPopulation)} in the mapped area are in cells scoring Severe or worse.`
            : 'Waiting for the risk surface.'}
        </p>
      </div>

      <div className="border-t border-hairline pt-lg">
        <label htmlFor="hours" className="tabular text-xs uppercase tracking-[0.2em] text-ink-3">
          Forecast hour{whenLabel ? ` — ${whenLabel} IST` : ''}
        </label>
        <input
          id="hours"
          type="range"
          min={0}
          max={72}
          step={1}
          value={hoursAhead}
          onChange={(e) => setHoursAhead(Number(e.target.value))}
          className="mt-sm w-full accent-[var(--color-accent)]"
        />
        <div className="tabular flex justify-between text-xs text-ink-3">
          <span>Now</span>
          <span>+72 h</span>
        </div>
      </div>

      <div className="border-t border-hairline pt-lg">
        <p className="tabular text-xs uppercase tracking-[0.2em] text-ink-3">Scenario</p>
        <div className="mt-sm flex flex-wrap gap-2xs">
          {SCENARIOS.map((s) => (
            <button
              key={s.offset}
              onClick={() => setTempOffset(s.offset)}
              title={s.hint}
              aria-pressed={tempOffset === s.offset}
              className={`tabular rounded-pill px-sm py-2xs text-xs whitespace-nowrap transition-colors duration-[var(--dur-fast)] ${
                tempOffset === s.offset
                  ? 'bg-accent text-accent-ink'
                  : 'border border-hairline text-ink-3 hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-sm text-xs text-ink-3">
          {tempOffset === 0
            ? 'Showing the actual forecast. In the monsoon this map should look calm — that is the model working, not a bug.'
            : `Every cell shifted +${tempOffset} °C to show what this tool does in a heatwave. Marked as simulated everywhere it appears.`}
        </p>
      </div>

      <div className="border-t border-hairline pt-lg">
        <label className="flex cursor-pointer items-center gap-sm text-sm">
          <input
            type="checkbox"
            checked={showFacilities}
            onChange={(e) => setShowFacilities(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          <span className="text-ink-2">Existing hospitals &amp; water points ({facilityCount})</span>
        </label>
      </div>

      <p className="text-xs text-ink-3">
        Click any cell for its breakdown.
        {meta?.forecastFetchedAt &&
          ` Forecast fetched ${new Date(meta.forecastFetchedAt).toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'Asia/Kolkata',
          })} IST.`}
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-lg left-lg z-10 rounded-md border border-hairline bg-paper/85 p-sm backdrop-blur-sm">
      <div className="flex items-end gap-2xs">
        {RISK_BANDS.map((b) => (
          <div key={b.key} className="w-[46px]">
            <div className="h-[6px] rounded-pill" style={{ background: b.hex }} />
            <p className="tabular mt-2xs text-[10px] uppercase tracking-[0.08em] text-ink-3">
              {b.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The wall-clock time the dashboard was opened, resolved once at hydration.
 * Null during the server render so nothing time-dependent is emitted there.
 */
function useBootTime(): number | null {
  return useSyncExternalStore(
    () => () => {},
    () => BOOT_MS,
    () => null, // server render emits nothing time-dependent
  );
}

const BOOT_MS = Date.now();
