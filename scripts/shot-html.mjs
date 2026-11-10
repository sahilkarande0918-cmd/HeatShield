/** Render a local HTML file to a transparent PNG at its body size. */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const src = resolve(process.argv[2]), out = resolve(process.argv[3]);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1582, height: 834 }, deviceScaleFactor: 2 });
await p.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
await p.locator('body').screenshot({ path: out, omitBackground: true });
console.log('saved', out);
await b.close();
