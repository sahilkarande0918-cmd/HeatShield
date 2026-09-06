/**
 * Headless screenshot + in-page assertion helper.
 *
 * A map app cannot be verified by reading the DOM: MapLibre only initialises
 * when requestAnimationFrame fires, which does not happen in a hidden or
 * headless-without-GL context, so a broken map and a working one look
 * identical to every other kind of check. This drives a real Chromium with
 * software GL and can both screenshot and evaluate against the live map
 * (exposed as window.__hsMap).
 *
 * Usage:
 *   node scripts/screenshot.mjs <url> <out.png> [w] [h] [waitMs] [evalExpr] [clickButtonText] [clickX,Y]
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:3001/dashboard';
const out = process.argv[3] ?? 'shot.png';
const width = Number(process.argv[4] ?? 1440);
const height = Number(process.argv[5] ?? 900);
const waitMs = Number(process.argv[6] ?? 9000);
const script = process.argv[7];
const clickText = process.argv[8];
const clickXY = process.argv[9]; // "x,y" — for canvas targets a selector cannot reach

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200));
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(waitMs);

if (clickText) {
  await page.getByRole('button', { name: clickText, exact: true }).click();
  await page.waitForTimeout(7000);
}

if (clickXY) {
  const [x, y] = clickXY.split(',').map(Number);
  await page.mouse.click(x, y);
  await page.waitForTimeout(2500);
  // The advisory is drafted on request, so ask for one if the button is there.
  const btn = page.getByRole('button', { name: /Draft an advisory/ });
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(28000);
  }
}

if (script) {
  try {
    console.log('EVAL:', JSON.stringify(await page.evaluate(script)));
  } catch (e) {
    console.log('EVAL FAILED:', e.message.slice(0, 300));
  }
}

await page.screenshot({ path: out });
console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
console.log('saved', out);
await browser.close();
