import Link from 'next/link';
import Hero from '@/components/Hero';

// Genuinely ordinal: each stage consumes the previous one's output.
const STAGES = [
  {
    n: '1',
    title: 'Map the ground that does not change',
    body: 'Building density, vegetation cover and population from open satellite and OSM data, resolved to ~1 km cells. This is the part of the risk that is baked into the built city.',
  },
  {
    n: '2',
    title: 'Fold in the next 72 hours',
    body: 'Live temperature and humidity forecasts are fused with that static layer every day, so a cell that is merely dense on a mild Tuesday becomes dangerous on a 44 °C Friday.',
  },
  {
    n: '3',
    title: 'Say where the water goes',
    body: 'A coverage optimizer reads today’s surface against the hospitals and water points that already exist, and proposes the placements that protect the most people at risk.',
  },
];

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />

      <hr className="border-0 border-t-[3px] border-accent" />

      <section className="bg-paper-2 px-lg py-3xl sm:px-xl">
        <h2 className="max-w-[18ch] text-display-s font-bold">
          Heat mapping is solved. Heat action isn’t.
        </h2>
        <p className="mt-lg max-w-[62ch] text-lg text-ink-2">
          India already knows how to draw a good heat map — SEEDS and Microsoft did it
          building-by-building, Ahmedabad’s Heat Action Plan has been saving lives since 2013. What
          no map tells a ward officer is the thing they actually have to decide on Monday morning:
          given four tankers and two halls, where do they go? HeatShield is built around that
          question.
        </p>

        <ol className="mt-3xl grid gap-2xl md:grid-cols-3">
          {STAGES.map((s) => (
            <li key={s.n} className="border-t border-hairline pt-lg">
              <span className="tabular block text-xs uppercase tracking-[0.24em] text-accent">
                Stage {s.n}
              </span>
              <h3 className="mt-sm text-2xl font-semibold">
                {s.title}
              </h3>
              <p className="mt-sm text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>

        <Link
          href="/dashboard"
          className="mt-3xl inline-flex items-center gap-sm rounded-pill bg-accent px-lg py-sm font-medium whitespace-nowrap text-accent-ink transition-transform duration-[var(--dur-fast)] ease-out hover:-translate-y-[1px] active:translate-y-[1px]"
        >
          Open the live map
        </Link>
      </section>

      {/* Ft5 — statement footer. The page argued something; the footer states it. */}
      <footer className="px-lg py-2xl sm:px-xl">
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
