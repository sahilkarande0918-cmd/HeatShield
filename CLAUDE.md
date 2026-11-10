# HeatShield — project rules

**At session start or after compaction, read `HANDOFF.md` first.**

HeatShield is a software-only, ward-level urban heat-risk early-warning and
relief-siting system (Next.js + Neon + MapLibre + Gemini), for PCCOE Indradhanu
2026. The differentiator is *where to place cooling relief*, not the heat map.

## Hard constraints
- **No invented data or claims.** Honest empty/loading states, never fake numbers.
- **Free-tier only.** LLM is **Gemini** (`gemini-3.6-flash`), not Claude/paid APIs.
- **Design = "cool chrome, hot data":** cool near-black UI, one desaturated cyan
  accent for UI only; warm red/orange/yellow only for real risk values. No orange chrome.
- **Never commit** `.env*`, `DATABASE_URL`, `GEMINI_API_KEY`, or large media
  (video, renders, `outputs/`, deck PNGs). Check `.gitignore` first.
- **Locked demo numbers (Simulated +12 °C, Pune):** 26 water points, 5 new sites,
  coverage 9.5% → 19.3% (reach of at-risk people), +2,58,135 more reached, 19 ms,
  26,40,714 at risk. Outcome numbers carry: "Simulated +12 °C scenario, Pune.
  Model result, not a field measurement."
- Video V2: output `out/HeatShield_v2.mp4`, **never overwrite V1** (the fallback).

## Commit rules
- **No AI attribution** — no `Co-Authored-By`, no "Generated with Claude", nothing.
  Messages read as a human wrote them: plain, conventional (what + why).
- Git identity repo-local: **Sahil Karande <sahilkarande0918@gmail.com>**.
- Small, logical commits. Commit/push only when asked. Branch off `main` first if told to.
