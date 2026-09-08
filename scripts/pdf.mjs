/**
 * Render an HTML file to PDF and to per-page PNGs for visual QA.
 *
 * Chromium's print pipeline rather than a Word/LibreOffice round trip: this
 * document is laid out with CSS grid and inline SVG, and print CSS is the only
 * thing that reproduces it exactly. It also lets me check the page count is
 * really ten rather than nine-and-a-bit.
 *
 *   node scripts/pdf.mjs docs/documentation.html docs/HeatShield-Documentation.pdf
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const src = resolve(process.argv[2]);
const out = resolve(process.argv[3]);
const shotDir = process.argv[4];

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
page.on('requestfailed', (r) => errors.push(`asset failed: ${r.url().slice(0, 90)}`));

await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle', timeout: 60000 });
// Webfonts must be resolved before layout is measured, or the page count moves.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  preferCSSPageSize: true,
});

/**
 * Overflow check.
 *
 * Measuring the .page box is useless: it is a fixed A4 height with
 * overflow:hidden, so it always reports 1123px whether the content fits or is
 * being silently guillotined. What matters is how far the last child actually
 * reaches inside the padding box.
 */
const report = await page.evaluate(() => {
  return [...document.querySelectorAll('.page')].map((el, i) => {
    const cs = getComputedStyle(el);
    const padB = parseFloat(cs.paddingBottom);
    const limit = el.clientHeight - padB;
    // Rects, not offsetTop: an <svg> is an SVGElement and has no offsetTop,
    // which silently produced NaN and hid a page from the overflow check.
    const pageTop = el.getBoundingClientRect().top;
    let lowest = 0;
    for (const kid of el.children) {
      if (kid.classList.contains('folio') || kid.classList.contains('rh')) continue;
      if (getComputedStyle(kid).position === 'absolute') continue;
      lowest = Math.max(lowest, kid.getBoundingClientRect().bottom - pageTop);
    }
    return { page: i + 1, lowest: Math.round(lowest), limit: Math.round(limit) };
  });
});
console.log(`sections: ${report.length}`);
for (const r of report) {
  const slack = r.limit - r.lowest;
  const flag = slack < 0 ? '  <-- OVERFLOWS' : slack > 190 ? '  <-- sparse' : '';
  console.log(`  page ${String(r.page).padStart(2)}  content ends ${String(r.lowest).padStart(4)}px  limit ${r.limit}px  slack ${String(slack).padStart(4)}px${flag}`);
}

if (shotDir) {
  mkdirSync(shotDir, { recursive: true });
  const els = await page.$$('.page');
  for (const [i, el] of els.entries()) {
    await el.screenshot({ path: `${shotDir}/page-${String(i + 1).padStart(2, '0')}.png` });
  }
  console.log(`wrote ${els.length} page images to ${shotDir}`);
}

console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
console.log('saved', out);
await browser.close();
