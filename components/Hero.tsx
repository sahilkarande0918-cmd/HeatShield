import Link from 'next/link';
import RiskSurface from './RiskSurface';

export default function Hero() {
  return (
    <header className="relative min-h-[100svh] flex flex-col overflow-hidden">
      {/* The surface sits behind everything and bleeds off the right edge. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 translate-y-[10%]"
        // Feathered on every side so the surface dissolves into the paper
        // instead of ending on a hard rectangular seam.
        style={{
          maskImage:
            'radial-gradient(70% 66% at 74% 58%, #000 22%, transparent 74%)',
          WebkitMaskImage:
            'radial-gradient(70% 66% at 74% 58%, #000 22%, transparent 74%)',
        }}
      >
        <RiskSurface />
      </div>

      {/* N9 — edge-aligned nav. No centred pill, no wordmark-plus-five-links. */}
      <nav className="flex items-center justify-between px-lg py-lg sm:px-xl">
        <span className="tabular text-xs uppercase tracking-[0.22em] text-ink-2">
          HeatShield
        </span>
        <Link
          href="/dashboard"
          className="tabular text-xs uppercase tracking-[0.18em] text-accent underline decoration-hairline underline-offset-[6px] transition-colors duration-[var(--dur-fast)] hover:decoration-accent"
        >
          Open the map →
        </Link>
      </nav>

      <div className="flex flex-1 flex-col justify-center px-lg pb-2xl sm:px-xl">
        <h1
          className="rise max-w-[13ch] text-display font-extrabold"
          style={{ animationDelay: '120ms' }}
        >
          The city is not one temperature.
        </h1>

        <p
          className="rise mt-lg max-w-[46ch] text-lg text-ink-2"
          style={{ animationDelay: '380ms' }}
        >
          A citywide forecast of 42&thinsp;°C hides the lane where it is 48. HeatShield resolves
          heat risk to the block, three days out — and then says where to put the water.
        </p>
      </div>

      <div
        className="rise flex items-end justify-between gap-lg px-lg pb-lg sm:px-xl"
        style={{ animationDelay: '620ms' }}
      >
        <RiskLegend />
        <span className="tabular hidden text-xs uppercase tracking-[0.2em] text-ink-3 sm:block">
          Scroll
        </span>
      </div>
    </header>
  );
}

function RiskLegend() {
  return (
    <div className="min-w-0">
      <div className="flex h-[6px] w-[min(340px,60vw)] overflow-hidden rounded-pill">
        {['--color-risk-0', '--color-risk-1', '--color-risk-2', '--color-risk-3', '--color-risk-4'].map((v) => (
          <span key={v} className="flex-1" style={{ background: `var(${v})` }} />
        ))}
      </div>
      <p className="tabular mt-xs text-xs uppercase tracking-[0.18em] text-ink-3">
        Low → Extreme
      </p>
    </div>
  );
}
