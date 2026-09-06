# HeatShield

Hyperlocal urban heat-risk early warning for Indian cities. HeatShield maps heat risk at
grid-cell resolution inside a city (not one citywide number), fuses that static vulnerability
layer with live 24–72h temperature and humidity forecasts so the map updates daily, and then
does the part nobody else does: it **recommends action** — an optimizer that proposes where to
place cooling relief points to protect the most at-risk people, plus auto-generated ward-level
advisories a municipal officer could actually send.

Heat mapping is largely solved. Heat *action* isn't. HeatShield closes that gap.

## Stack

Next.js (App Router) + TypeScript · Tailwind · MapLibre GL + OpenFreeMap · Neon Postgres +
Drizzle · Open-Meteo (live forecast) · Google Gemini (advisories) · React Three Fiber (hero) ·
deployed on Vercel.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and GEMINI_API_KEY
npm run dev
```

## Data honesty

Live forecasts come from [Open-Meteo](https://open-meteo.com), not IMD — IMD has no stable
public API. The static vulnerability layer is precomputed offline from open satellite/OSM/census
inputs and seeded into Postgres; it is not recomputed per request. Nothing in the UI is
hardcoded — if a data source is down you will see an empty state, not a made-up number.
