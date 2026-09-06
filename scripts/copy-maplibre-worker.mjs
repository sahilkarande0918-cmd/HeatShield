/**
 * MapLibre v6 spins up its tile-parsing worker with
 * `new Worker(new URL('./maplibre-gl-worker.mjs', import.meta.url))`. Neither
 * Turbopack dev nor `next build` produces a URL the browser can actually fetch
 * for that — both 404 to the HTML fallback, the worker never starts, and the
 * map renders as a blank rectangle with no error beyond a MIME-type warning.
 *
 * So we serve the worker ourselves out of public/ and point MapLibre at it
 * with setWorkerUrl(). This script keeps that copy in sync with the installed
 * version; it runs before dev and before build, so it also works on a fresh
 * Vercel checkout where public/maplibre does not exist yet.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.css'));
const out = join(process.cwd(), 'public', 'maplibre');

mkdirSync(out, { recursive: true });
// The worker imports the shared chunk by relative path, so both must sit
// side by side under the same public directory.
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(dist, f), join(out, f));
}
console.log(`maplibre worker copied to public/maplibre (v${require('maplibre-gl/package.json').version})`);
