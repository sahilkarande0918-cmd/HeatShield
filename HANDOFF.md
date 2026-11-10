# HeatShield — HANDOFF

Read this first after any compaction or at session start.

## a) PROJECT
HeatShield is a **software-only, ward-level urban heat-risk early-warning and
relief-siting system** for Indian cities. It maps heat risk at grid/ward level,
forecasts it 24–72 h ahead, and **recommends where to place cooling relief** so
it protects the most people — that siting step is the differentiator
("heat mapping is solved; heat *action* isn't").
- **Competition:** PCCOE Indradhanu International Grand Challenge 2026 — theme
  "AI for Climate Change", SDG 13.
- **Deadlines:** Round 2 video due **10 Nov 2026**. Round 3 is a **24-hour
  offline hackathon at PCCOE Nigdi**.
- **Owner:** Sahil Karande (sahilkarande0918@gmail.com). Cities: **Pune, Ahmedabad**.

## b) STACK & INFRA
- **Next.js 16.3.4** (App Router) + TypeScript, React 19, Tailwind v4,
  Framer Motion, **MapLibre GL v6** + OpenFreeMap tiles.
- **Neon serverless Postgres** + Drizzle ORM. **Open-Meteo** live forecast
  (keyless). Overpass/OSM for seed data. Nominatim reverse-geocode.
- **LLM advisories: Google Gemini** via `@google/genai`, model
  **`gemini-3.6-flash`** (`lib/advisory.ts:15`). Falls back to a deterministic
  template when no key. (No Anthropic/Claude in the app code.)
- Hand-written **greedy coverage-maximizing siting optimizer** (`lib/optimizer.ts`).
- **Deploy:** Vercel, from GitHub. **Repo:** https://github.com/sahilkarande0918-cmd/HeatShield
  **Deployed URL:** not recorded in repo — check the Vercel dashboard / `.vercel`.

## c) STATUS
- **DONE** — Full 9-phase app (map, fusion model, optimizer, forecast chart,
  advisories, deployment hardening). App code committed up to `120a87e`.
  `app/`, `components/`, `lib/`, `db/`, `scripts/`.
- **DONE** — Both cities seeded; live fusion verified honest (a real monsoon
  afternoon scores ~0 at risk, which is correct). 10-page docs PDF.
- **DONE (this session)** — Pitch deck as an **image-based PPTX**
  (`outputs/HeatShield-Deck.pptx`, gitignored): black-box/mask fixes, bold
  removed, +12 °C dashboard screenshot, reconciled slide-6/7 numbers. Deck
  *source* (chart.html, patch scripts, figures.json) is committed under `deck/`.
- **IN PROGRESS / NOT STARTED** — **Round-2 video V2** (HyperFrames HTML→MP4).
  Not built in this repo yet. V1 is the fallback submission — never overwrite it.

## d) DECISIONS & WHY (do not re-argue)
- **Gemini, not Claude/paid APIs** — everything must be free-tier (a municipality
  could run it without procurement). 2.5-flash is closed to new keys → 3.6-flash.
- **Percentile-rank normalisation** (not log+min-max) for vulnerability, or the
  whole city paints "severe" (median hit 76/100). See `db/scripts/seed.ts`.
- **Optimizer counts only public water points as existing relief** (26 for Pune),
  not hospitals/clinics — a clinic is not a cooling shelter. Toggle exposes this.
- **Deck is rasterised to PPTX** on purpose: the Canva export's font/soft-mask
  quirks render as black boxes / tofu in some viewers; a clean render per slide
  is viewer-proof. Trade-off: not text-editable.
- **Coverage is expressed as % of at-risk people reached within 1 km**, one
  definition everywhere, so slide 6 and slide 7 reconcile (see LOCKED FACTS).

## e) HARD CONSTRAINTS & LOCKED FACTS
- **No invented data or claims.** Honest empty/loading states over fake numbers.
- **No AI attribution in commits** (no Co-Authored-By, no "Generated with Claude").
  Git identity repo-local: **Sahil Karande**.
- **Never commit** secrets (`.env*`, `DATABASE_URL`, `GEMINI_API_KEY`) or large
  media (video, renders, `outputs/`, deck PNGs). `.gitignore` covers these.
- **Design — "cool chrome, hot data":** cool near-black base, **one desaturated
  cyan accent for UI only**; warm red/orange/yellow is reserved for **real risk
  values only**. No orange UI chrome.
- **Locked demo numbers (Simulated +12 °C scenario, Pune):** 26 water points,
  5 new sites, coverage **9.5% → 19.3%** (reach of at-risk people; 1 in 10 → 1 in
  5), **+2,58,135 more people reached**, optimizer **19 ms**, **26,40,714 at risk**
  of 31,24,464. Outcome numbers always carry the caption **"Simulated +12 °C
  scenario, Pune. Model result, not a field measurement."**
- Video V2 (if/when built): HyperFrames HTML→MP4, output `out/HeatShield_v2.mp4`,
  **never overwrite V1**. Narration unchanged, live-demo segment untouched,
  B-roll ≤15% and licensed only (Pexels/Pixabay/Mixkit).

## f) FILE MAP (10 most important)
1. `lib/risk.ts` — 0–100 risk scale + colour ramp (single source of truth).
2. `lib/fusion.ts` (+ `fusion.check.ts`) — live risk model: UHI offset +
   thermal-stress bands + exposure weighting.
3. `lib/optimizer.ts` (+ `optimizer.check.ts`) — greedy maximal-coverage siting.
4. `lib/advisory.ts` — Gemini advisory generator (`MODEL` on line 15) + template fallback.
5. `db/scripts/seed.ts` — offline vulnerability pipeline (`rank01()` percentile norm).
6. `db/schema.ts` — Drizzle schema (gridCells, facilities, forecasts, advisories).
7. `app/page.tsx` / `app/dashboard/page.tsx` — landing + map app.
8. `app/api/*/route.ts` — risk / forecast / optimize / advisory / facilities.
9. `deck/chart.html` + `scripts/shot-html.mjs` — reconciled slide-7 chart → `deck/assets/chart.png`.
10. `deck/patch_v3.py` + `scripts/capture-deck-assets.mjs` — deck PDF surgery + live dashboard capture.

## g) RUN / TEST / BUILD / DEPLOY
```
npm install
cp .env.example .env.local        # fill values (names only below)
npm run dev                        # localhost:3000
npm run check                      # model + optimizer self-checks
npm run seed -- pune|ahmedabad     # ~10 min, Overpass-cached
npm run db:push                    # push Drizzle schema to Neon
npm run build && npm run start     # prod build (needs well-formed DATABASE_URL)
npm run warm -- <deployed-url>     # pre-demo warm-up
```
Deck assets: `node scripts/capture-deck-assets.mjs deck/assets` (needs app at
:3001), `node scripts/shot-html.mjs deck/chart.html deck/assets/chart.png`.
**Env var NAMES only:** `DATABASE_URL`, `GEMINI_API_KEY`, `NEXT_PUBLIC_DEFAULT_CITY`.

## h) KNOWN BUGS / RISKS / OPEN QUESTIONS
- PPTX is **image-based** (not editable); edits require re-rendering slides.
- `25.5%` weighted-demand coverage from the app does NOT divide to the headcount
  gain — the deck deliberately uses the reconciled **19.3%** reach figure instead.
  If you ever show 25.5%, label it "coverage of weighted heat-risk demand".
- Deployed Vercel URL not captured here — confirm it before `npm run warm`.
- `gemini-2.5-flash` references in `lib/advisory.ts` comments are historical.

## i) NEXT STEPS (do the first one first)
1. Confirm the live Vercel URL and that the deployed app loads the map (open it
   in a real browser; MapLibre only inits when rAF fires).
2. Build the **Round-2 video V2** (HyperFrames → `out/HeatShield_v2.mp4`), keeping
   V1 untouched; use the Locked demo numbers + required caption.
3. Optional: add a one-line footnote on deck slide 7 defining "today's relief".

## j) EXACTLY WHAT I WAS DOING
Finishing the **pitch-deck PPTX**, not the app. Last action: edited
`deck/chart.html` (recommended ring 25.5%→**19.3%**, dasharray `114 476.6`, pill →
"+2,58,135 more people reached", subtitle "reaches 1 in 5 people at risk"),
re-rendered `deck/assets/chart.png` via `scripts/shot-html.mjs`, re-composited it
into slide 7 and rebuilt `outputs/HeatShield-Deck.pptx`. No errors. Then this
compaction/handoff. The raster slide-editing happens in the session scratchpad,
not in the repo — the committed deck *sources* (chart.html, patch_v3.py, capture
scripts, figures.json) are what reproduce it.
