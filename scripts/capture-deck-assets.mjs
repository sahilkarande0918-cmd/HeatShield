/**
 * Capture the dashboard screenshot AND the numbers printed on it in one run,
 * so the slide showing the product and the slide charting its result cannot
 * disagree. Two separate captures drift, because the live forecast moves.
 *
 *   node scripts/capture-deck-assets.mjs <outDir>
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(process.argv[2] ?? 'deck/assets');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:3001/dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(11000);

// The heatwave scenario — a September monsoon afternoon honestly scores near
// zero, which is the model working but the wrong frame for a pitch slide.
await page.getByRole('button', { name: '+12 °C', exact: true }).click();
await page.waitForTimeout(9000);

const figures = await page.evaluate(() => {
  const aside = document.querySelector('aside')?.innerText ?? '';
  const grab = (re) => (aside.match(re) || [])[1] ?? null;
  return {
    peopleAtRisk: grab(/PEOPLE AT RISK NOW\s*\n\s*([\d,]+)/i),
    totalPopulation: grab(/of ([\d,]+) in the mapped area/i),
    gain: grab(/\+([\d,]+)\s*\n?\s*more at-risk/i),
    today: grab(/Today\s+([\d.]+)%/i),
    recommended: grab(/Recommended\s+([\d.]+)%/i),
    sites: grab(/Budget\s+—\s+(\d+)/i),
    waterPoints: grab(/With it off,\s*(\d+)\s*mapped public water points/i),
  };
});

await page.screenshot({ path: `${out}/dashboard.png` });
writeFileSync(`${out}/figures.json`, JSON.stringify(figures, null, 2));
console.log(JSON.stringify(figures, null, 2));
console.log('saved', `${out}/dashboard.png`);
await browser.close();
