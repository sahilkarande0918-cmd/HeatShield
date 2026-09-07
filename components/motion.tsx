'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The two pieces of scroll motion on the content pages.
 *
 * Both are built on real scroll position rather than a scroll-hijacking
 * library. Lenis-style smoothing looks good in a demo reel and then fights
 * every trackpad, breaks find-in-page and keyboard paging, and puts a frame of
 * latency between the user's gesture and the page. Parallax on the native
 * scroll offset gets the same sense of depth and costs nothing.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveals children once, on a stagger, when the container enters the viewport.
 *
 * Every child gets `.reveal`, whose resting state is the visible one — so if
 * IntersectionObserver never fires (an old browser, a hidden tab that never
 * intersects) the content is still on the page and still readable. This is the
 * same rule as the hero: nothing may depend on a script running to be seen.
 */
export function Reveal({
  children,
  className,
  stagger = 110,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** ms between each child. */
  stagger?: number;
  as?: 'div' | 'ol' | 'ul';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const kids = Array.from(el.children) as HTMLElement[];
    const show = () =>
      kids.forEach((k, i) => {
        k.style.transitionDelay = prefersReducedMotion() ? '0ms' : `${i * stagger}ms`;
        k.dataset.shown = 'true';
      });

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      show();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            show();
            io.disconnect(); // once, not on every pass
            break;
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stagger]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Translates its children against the scroll, for depth.
 *
 * `speed` is the fraction of scroll distance the element moves by; negative
 * values drift it upward. Reads scroll position inside a rAF so a fast wheel
 * cannot queue more work than the compositor can drain, and writes only
 * `transform`, which never triggers layout.
 */
export function useParallax<T extends HTMLElement>(speed = 0.18) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      // Distance of this element's centre from the viewport centre, so the
      // effect is symmetrical whichever direction it is scrolled past.
      const offset = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.transform = `translate3d(0, ${(-offset * speed).toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [speed]);

  return ref;
}

/** Wrapper form of useParallax, for markup that does not need its own client file. */
export function Parallax({
  speed = 0.18,
  className,
  children,
}: {
  speed?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useParallax<HTMLDivElement>(speed);
  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

/**
 * Kicks the hero video into playing as early as the browser allows.
 *
 * `preload="metadata"` plus autoplay meant the first frame did not paint for
 * about a second: the browser fetched the header, then waited to be told to
 * buffer. With `preload="auto"` and an explicit play() on the first frame of
 * data, plus a poster painting immediately underneath, the fold is never
 * empty. Autoplay can still be refused (a battery-saver tab, a strict policy);
 * the poster is what the viewer sees then, which is why it exists.
 */
export function useAutoPlay<T extends HTMLVideoElement>() {
  const ref = useRef<T | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const tryPlay = () => {
      void v.play().catch(() => {
        /* refused; the poster stands in */
      });
    };

    if (v.readyState >= 2) tryPlay();
    v.addEventListener('loadeddata', tryPlay);
    v.addEventListener('canplay', tryPlay);
    const onPlaying = () => setReady(true);
    v.addEventListener('playing', onPlaying);

    return () => {
      v.removeEventListener('loadeddata', tryPlay);
      v.removeEventListener('canplay', tryPlay);
      v.removeEventListener('playing', onPlaying);
    };
  }, []);

  return { ref, ready };
}
