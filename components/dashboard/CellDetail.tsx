'use client';

import type { CellProps } from '@/components/RiskMap';
import { riskBand } from '@/lib/risk';

const fmt = (n: number) => n.toLocaleString('en-IN');
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Why this cell scores what it scores. A number a ward officer cannot
 * interrogate is a number they will not act on, so every component that fed
 * the score is shown alongside it.
 */
export default function CellDetail({
  cell,
  onClose,
}: {
  cell: CellProps;
  onClose: () => void;
}) {
  const band = riskBand(cell.risk);

  const factors = [
    { label: 'Built-up density', value: cell.buildingDensity, worseWhenHigh: true },
    { label: 'Green cover', value: cell.greenCover, worseWhenHigh: false },
    { label: 'Near open water', value: cell.waterProximity, worseWhenHigh: false },
  ];

  return (
    <div className="flex flex-col gap-lg p-lg">
      <div className="flex items-start justify-between gap-md">
        <div>
          <p className="tabular text-xs uppercase tracking-[0.2em] text-ink-3">
            {cell.lat.toFixed(4)}, {cell.lng.toFixed(4)}
          </p>
          <p
            className="mt-2xs text-2xl font-semibold"
            style={{ color: band.hex, fontFamily: 'var(--font-display)' }}
          >
            {band.label}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close cell details"
          className="rounded-sm px-xs py-2xs text-ink-3 transition-colors duration-[var(--dur-fast)] hover:text-ink"
        >
          ✕
        </button>
      </div>

      <p className="text-ink-2">{band.meaning}</p>

      <dl className="grid grid-cols-2 gap-md border-t border-hairline pt-lg">
        <Stat label="Risk score" value={cell.risk.toFixed(0)} accent={band.hex} />
        <Stat label="People here" value={fmt(cell.population)} />
        <Stat label="Feels like" value={`${cell.feelsLikeC.toFixed(1)} °C`} />
        <Stat label="Regional forecast" value={`${cell.regionalC.toFixed(1)} °C`} />
      </dl>

      <div className="border-t border-hairline pt-lg">
        <p className="tabular text-xs uppercase tracking-[0.2em] text-ink-3">Why</p>
        <p className="mt-xs text-sm text-ink-2">
          This block runs{' '}
          <strong className="text-ink">
            {(cell.feelsLikeC - cell.regionalC).toFixed(1)} °C hotter
          </strong>{' '}
          than the regional forecast because of what is built here.
        </p>
        <ul className="mt-md flex flex-col gap-sm">
          {factors.map((f) => (
            <li key={f.label}>
              <div className="flex items-baseline justify-between gap-md text-sm">
                <span className="text-ink-2">{f.label}</span>
                <span className="tabular text-ink-3">{pct(f.value)}</span>
              </div>
              <div className="mt-2xs h-[3px] w-full overflow-hidden rounded-pill bg-paper-3">
                <div
                  className="h-full rounded-pill"
                  style={{
                    width: `${Math.max(2, f.value * 100)}%`,
                    background: f.worseWhenHigh ? band.hex : 'var(--color-ink-3)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-ink-3">
        Vulnerability {cell.vulnerability.toFixed(0)}/100 is this cell&rsquo;s standing relative to
        the rest of the city and does not change day to day. The risk score above does.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <dt className="tabular text-xs uppercase tracking-[0.16em] text-ink-3">{label}</dt>
      <dd
        className="tabular mt-2xs text-xl"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
