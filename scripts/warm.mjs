/**
 * Pre-demo warm-up.
 *
 * The first request of the day pays for an Open-Meteo fetch and the first read
 * of the grid out of Neon — about five seconds, and on Vercel a cold function
 * start on top of that. Run this a minute before presenting and every path a
 * judge touches is already warm.
 *
 *   npm run warm                          (localhost:3000)
 *   npm run warm -- https://your.vercel.app
 */
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const cities = ['pune', 'ahmedabad'];

const paths = cities.flatMap((c) => [
  `/api/risk?city=${c}&tempOffset=0`,
  `/api/risk?city=${c}&tempOffset=12`,
  `/api/forecast?city=${c}&tempOffset=12`,
  `/api/facilities?city=${c}`,
  `/api/optimize?city=${c}&tempOffset=12&sites=5`,
]);

let failed = 0;
for (const p of ['/', '/dashboard', ...paths]) {
  const t0 = Date.now();
  try {
    const res = await fetch(base + p, { signal: AbortSignal.timeout(60_000) });
    const ms = Date.now() - t0;
    console.log(`${res.ok ? 'ok  ' : 'FAIL'} ${String(ms).padStart(6)}ms  ${p}`);
    if (!res.ok) {
      failed++;
      console.log(`     ${(await res.text()).slice(0, 160)}`);
    }
  } catch (err) {
    failed++;
    console.log(`FAIL         --  ${p}  ${String(err).slice(0, 120)}`);
  }
}

console.log(failed === 0 ? '\nAll warm.' : `\n${failed} endpoint(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
