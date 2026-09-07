'use client';

import Link from 'next/link';
import { useAutoPlay, useParallax } from './motion';

/**
 * The hero.
 *
 * The video is the hero visual now; the WebGL risk surface has moved down the
 * page to sit behind the explainer. Running a looping video and a live Three.js
 * scene in the same viewport meant two continuous render paths competing for
 * the same GPU and the same pixels — a real cost, not a stylistic one.
 *
 * Everything on top of the video is chrome: off-white type, one ice-blue
 * accent on the single call to action. No heat colour appears here, because
 * nothing here is a risk value.
 */
export default function Hero() {
  const { ref: videoRef } = useAutoPlay<HTMLVideoElement>();
  // Gentle, and negative so the footage drifts up slower than the page. Scaled
  // past the frame below so the translation never exposes an edge.
  const bgRef = useParallax<HTMLDivElement>(-0.14);

  return (
    <header className="relative flex min-h-[100svh] flex-col overflow-hidden">
      {/* ---- background ---------------------------------------------------
       * The poster is frame 0 of the loop, so it paints instantly and the
       * video crossing into place is invisible — that is what removes the
       * second of black the fold used to open on. preload="auto" because a
       * 4.8 MB hero is the point of the page, not a progressive enhancement.
       * Hidden entirely under prefers-reduced-motion (globals.css), which
       * leaves the poster and the same dark ground behind it.
       * ------------------------------------------------------------------ */}
      <div
        ref={bgRef}
        className="pointer-events-none absolute -inset-y-[12%] inset-x-0 -z-20 bg-paper bg-cover bg-center"
        style={{ backgroundImage: 'url(/hero-poster.jpg)', willChange: 'transform' }}
      >
        <video
          ref={videoRef}
          data-hero-loop
          className="h-full w-full object-cover"
          style={{ filter: 'saturate(0.72) contrast(1.04) brightness(0.92)' }}
          src="/hero-loop.mp4"
          poster="/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      </div>

      {/* Two overlays rather than one: a vertical wash to seat the nav and the
       * legend, and a stronger left-side gradient so the headline holds its
       * contrast over whatever the footage happens to be doing there. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-paper) 82%, transparent) 0%, ' +
            'color-mix(in oklab, var(--color-paper) 35%, transparent) 38%, ' +
            'color-mix(in oklab, var(--color-paper) 88%, transparent) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to right, color-mix(in oklab, var(--color-paper) 94%, transparent) 0%, ' +
            'color-mix(in oklab, var(--color-paper) 78%, transparent) 38%, ' +
            'color-mix(in oklab, var(--color-paper) 40%, transparent) 66%, transparent 92%)',
        }}
      />

      {/* Edge-aligned nav. Wordmark left, the one CTA right. */}
      <nav className="flex items-center justify-between px-lg py-lg sm:px-xl">
        <span className="tabular text-xs tracking-[0.22em] text-ink-2 uppercase">HeatShield</span>
        <Link
          href="/dashboard"
          className="tabular inline-flex min-h-[44px] items-center rounded-pill border border-accent/40 bg-accent/10 px-md text-xs tracking-[0.16em] whitespace-nowrap text-accent uppercase backdrop-blur-sm transition-colors duration-[var(--dur-fast)] hover:bg-accent hover:text-accent-ink"
        >
          Open the map →
        </Link>
      </nav>

      <div className="flex flex-1 flex-col justify-center px-lg pb-2xl sm:px-xl">
        <h1
          className="rise max-w-[19ch] text-display font-bold"
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
        <span className="tabular hidden text-xs tracking-[0.2em] text-ink-3 uppercase sm:block">
          Scroll
        </span>
      </div>
    </header>
  );
}

/**
 * The one place heat colour is allowed above the fold, because it is the
 * legend for the data system itself — it is explaining the ramp, not
 * decorating with it.
 */
function RiskLegend() {
  return (
    <div className="min-w-0">
      <div className="flex h-[6px] w-[min(340px,60vw)] overflow-hidden rounded-pill">
        {['--color-risk-0', '--color-risk-1', '--color-risk-2', '--color-risk-3', '--color-risk-4'].map(
          (v) => (
            <span key={v} className="flex-1" style={{ background: `var(${v})` }} />
          ),
        )}
      </div>
      <p className="tabular mt-xs text-xs tracking-[0.18em] text-ink-3 uppercase">Low → Extreme</p>
    </div>
  );
}
