import Link from 'next/link';
import Hero from '@/components/Hero';
import RiskSurface from '@/components/RiskSurface';
import { Parallax, Reveal } from '@/components/motion';

/**
 * Genuinely ordinal — each stage consumes the previous one's output — so the
 * sequence is carried by a numeral set into the type, not by an ALL-CAPS
 * "STAGE 1" tag over a hairline rule. That pairing is template chrome.
 *
 * The numerals are in the chrome accent at a size that makes them structural.
 * They were previously paper-3 on paper-2, roughly 1.4:1, which read as an
 * accident rather than a decision.
 */
const STAGES = [
  {
    n: '01',
    title: 'Map the ground that does not change',
    body: 'Building density, vegetation cover and population from open satellite and OSM data, resolved to ~1 km cells. This is the part of the risk that is baked into the built city.',
  },
  {
    n: '02',
    title: 'Fold in the next 72 hours',
    body: 'Live temperature and humidity forecasts are fused with that static layer every day, so a cell that is merely dense on a mild Tuesday becomes dangerous on a 44 °C Friday.',
  },
  {
    n: '03',
    title: 'Say where the water goes',
    body: 'A coverage optimizer reads today’s surface against the hospitals and water points that already exist, and proposes the placements that protect the most people at risk.',
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />

      {/* `isolate` matters: without a stacking context, `position: relative` with
          z-index auto lets the -z-10 children paint behind this section's own
          background, so both the glow and the risk surface were invisible.
          Inside a stacking context the background paints first, then negative-z
          descendants, then content — which is the order we want. */}
      <section className="relative isolate overflow-hidden bg-ground-1 px-lg py-3xl sm:px-xl">
        {/* One soft violet glow, anchored behind the headline. The hue is the
         * low end of the map's own risk scale pulled right down in chroma, so
         * the content pages and the map read as one colour story rather than
         * two unrelated palettes. It drifts slower than the page. */}
        <Parallax
          speed={0.06}
          className="pointer-events-none absolute -top-[22%] -left-[14%] -z-10 h-[52rem] w-[52rem]"
        >
          <div
            className="h-full w-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--color-violet-glow) 42%, transparent) 0%, ' +
                'color-mix(in oklab, var(--color-violet-glow) 14%, transparent) 38%, transparent 68%)',
            }}
          />
        </Parallax>

        {/* The WebGL risk surface, relocated out of the hero. It runs smaller
         * and quieter here, behind an argument about surfaces — where it reads
         * as an illustration of the thing being described rather than as
         * decoration, and where it is no longer competing with the video. */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[56%] opacity-70 lg:block"
          style={{
            maskImage: 'radial-gradient(66% 74% at 70% 48%, #000 24%, transparent 82%)',
            WebkitMaskImage: 'radial-gradient(66% 74% at 70% 48%, #000 24%, transparent 82%)',
          }}
        >
          <RiskSurface />
        </div>

        <h2 className="relative max-w-[18ch] text-display-s font-bold">
          Heat mapping is solved. Heat action isn’t.
        </h2>
        <p className="relative mt-lg max-w-[62ch] text-lg text-ink-2">
          India already knows how to draw a good heat map — SEEDS and Microsoft did it
          building-by-building, Ahmedabad’s Heat Action Plan has been saving lives since 2013. What
          no map tells a ward officer is the thing they actually have to decide on Monday morning:
          given four tankers and two halls, where do they go? HeatShield is built around that
          question.
        </p>

        {/* The one orchestrated motion moment in this section: three cards, one
         * staggered arrival, once. */}
        <Reveal as="ol" className="relative mt-3xl grid gap-lg md:grid-cols-3">
          {STAGES.map((s) => (
            <li
              key={s.n}
              className="reveal group rounded-md bg-violet-tint/45 p-lg transition-colors duration-[var(--dur-mid)] hover:bg-violet-tint/80"
            >
              <span className="step-numeral block" aria-hidden="true">
                {s.n}
              </span>
              <h3 className="mt-md text-2xl font-semibold">{s.title}</h3>
              <p className="mt-sm text-ink-2">{s.body}</p>
            </li>
          ))}
        </Reveal>

        <Link
          href="/dashboard"
          className="relative mt-3xl inline-flex items-center gap-sm rounded-pill bg-accent px-lg py-sm font-medium whitespace-nowrap text-accent-ink transition-transform duration-[var(--dur-fast)] ease-out hover:-translate-y-[1px] active:translate-y-[1px]"
        >
          Open the live map
        </Link>
      </section>

      <footer className="relative overflow-hidden bg-ground-2 px-lg py-2xl sm:px-xl">
        <p className="max-w-[30ch] text-2xl font-semibold">
          A heatwave is not a weather event. It is a distribution problem.
        </p>
        <div className="mt-xl flex flex-wrap items-center gap-x-lg gap-y-xs text-sm text-ink-3">
          <span>Forecasts: Open-Meteo</span>
          <span>Basemap: OpenFreeMap</span>
          <span>Built for SDG-13</span>
        </div>
      </footer>
    </main>
  );
}
