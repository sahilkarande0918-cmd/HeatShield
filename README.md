# HeatShield

Hyperlocal urban heat-risk early warning for Indian cities.

A citywide forecast of 42 °C hides the lane where it is 48. HeatShield resolves heat risk to
roughly 1 km inside a city, fuses that with live 24–72 hour forecasts so the map updates daily
rather than sitting frozen, and then does the part nobody else does: it **recommends where to put
cooling relief** and drafts the ward advisory to go with it.

Heat mapping is largely solved — SEEDS and Microsoft mapped Indian cities building by building,
and Ahmedabad's Heat Action Plan has been saving lives since 2013. Heat *action* is not. What no
map tells a ward officer is the thing they have to decide on Monday morning: given four tankers
and two halls, where do they go? HeatShield is built around that question.

Currently covers **Pune** and **Ahmedabad**.

## What it does

1. **Maps** vulnerability at grid-cell resolution from open data — building density, green cover
   and water proximity, weighted by how many people live in each cell.
2. **Forecasts** by fusing that static layer with live Open-Meteo temperature and humidity, so
   the same block is calm in November and dangerous in May.
3. **Acts** — a coverage optimizer proposes where new relief points would protect the most
   at-risk people, and Gemini drafts a plain-language advisory a ward officer could forward.

## Running locally

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL and GEMINI_API_KEY
npm run db:push                # create the tables in Neon
npm run seed                   # ~10 min: pulls OSM data and computes the vulnerability layer
npm run dev
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run seed -- pune` | Seed one city. Add `--dry` to fetch and score without writing to the database. |
| `npm run check` | Assert-based self-checks for the risk model and the optimizer. |
| `npm run warm` | Hit every endpoint so nothing is cold. Run this before a demo. |
| `npm run shot <url> <out.png>` | Headless screenshot — the only way to verify the map actually rendered. |

## Methodology, and what these numbers are not

**The vulnerability layer is a heat proxy, not satellite land-surface temperature.** Real LST needs
Google Earth Engine and a signup with an approval delay, so this is built entirely from free,
keyless sources: OpenStreetMap building footprints, parks and water bodies via Overpass, plus one
Census of India 2011 total per city. Components are stored separately, so a real LST column can
replace the proxy later without touching anything downstream.

```
building_density  count of OSM building footprints per cell
green_cover       share of the cell under parks, forest, grass or scrub
water_proximity   exponential decay of distance to the nearest open water
heat_proxy        0.55·built + 0.30·(1−green) + 0.15·(1−water)
population        Census city total split across cells in proportion to
                  building count (dasymetric redistribution)
vulnerability     0.65·heat_proxy + 0.35·population density, scaled 0–100
```

Scores are **percentile ranks within the city**, not absolute. Building counts are heavily
right-skewed, and min–max normalisation put the median Pune cell at 76/100 — the whole city painted
"severe", which is exactly the failure this project exists to fix. Ranking gives a flat spread so
the genuinely dangerous pockets separate. Absolute danger enters through the forecast, not here.

**Live risk** is three explainable steps: each cell gets an urban-heat-island offset proportional
to its heat proxy (up to 4 °C, the load-bearing assumption in the model); the resulting feels-like
temperature is scored against the NOAA heat-index danger bands; that stress is then weighted by who
is exposed.

**Forecasts are Open-Meteo, not IMD.** IMD publishes no stable documented public API, so the UI
credits Open-Meteo by name rather than implying an official source.

**The scenario buttons shift the forecast** so the tool can be shown working in a heatwave during
the monsoon. Anything shifted is labelled `simulated` in both the API response and the interface.
On a real mild day the map goes quiet and reports nobody at risk — that is the model working.

**What counts as existing relief is a judgement call, and it is exposed as a toggle.** OSM tags 714
hospitals and 450 clinics in Pune; counting them all puts existing coverage at 94% and makes the
siting question look solved. A private clinic is not a cooling shelter, and a hospital is where
somebody goes *after* heatstroke. The default counts public water points only — 26 of them, for 3.1
million people.

**Advisories are machine-drafted and labelled as such.** The model is given the cell's numbers and
told to invent none of its own; every response says whether Gemini or the template fallback wrote
it, and carries a review-before-sending notice.

The colour ramp is Inferno-derived and monotonic in lightness, so it survives red–green
colourblindness and greyscale — which the conventional green-to-red heat ramp does not.

## Stack

Next.js (App Router) + TypeScript · Tailwind v4 · MapLibre GL + OpenFreeMap tiles · Neon Postgres +
Drizzle · Open-Meteo · Google Gemini · React Three Fiber for the hero · Recharts · deployed on
Vercel. No paid services and no API key for anything except the database and Gemini, both free tier.

## Deploying

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set `DATABASE_URL`, `GEMINI_API_KEY` and `NEXT_PUBLIC_DEFAULT_CITY` under
   Settings → Environment Variables.
3. Deploy, then `npm run warm -- https://your-deployment.vercel.app`.

The server refuses to boot without `DATABASE_URL` and says where to get one, rather than failing
as a 500 halfway through a demo.
