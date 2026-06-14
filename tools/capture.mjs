// GPU-capable headless capture for the fidelity lab.
// Usage: node tools/capture.mjs <url> <outPath> [--preset "name"] [--scale 3]
//        [--width 1280] [--height 720] [--view-steps 192] [--light-steps 24]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const preset = opt('preset', null);
const scale = Number(opt('scale', 2));
const width = Number(opt('width', 1280));
const height = Number(opt('height', 720));
const viewSteps = Number(opt('view-steps', 192));
const lightSteps = Number(opt('light-steps', 24));
// --set "sunAzimuth=75,sunIntensity=10,betaRScale=0.45" — raw param overrides
const overrides = {};
for (const pair of (opt('set', '') || '').split(',').filter(Boolean)) {
  const [k, v] = pair.split('=');
  overrides[k.trim()] = Number.isNaN(Number(v)) ? v : Number(v);
}

const candidates = [
  join(homedir(), 'Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error('no chrome binary found');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-gpu', '--use-angle=metal', '--hide-scrollbars'],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: scale,
});
page.on('console', (m) => {
  if (m.type() === 'error') console.error('[page]', m.text());
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__exo !== undefined, { timeout: 15000 });

await page.evaluate(({ preset, scale, viewSteps, lightSteps, overrides }) => {
  document.querySelector('.lil-gui')?.style.setProperty('display', 'none');
  document.getElementById('hint')?.style.setProperty('display', 'none');
  if (preset) window.__exo.applyPreset(preset);
  Object.assign(window.__exo.params, overrides);
  window.__exo.setQuality(viewSteps, lightSteps, scale);
  window.__exo.renderOnce();
}, { preset, scale, viewSteps, lightSteps, overrides });

await page.waitForTimeout(400);
await page.evaluate(() => window.__exo.renderOnce());
await page.screenshot({ path: out });
await browser.close();
console.log(`captured ${out} (${width * scale}x${height * scale}${preset ? `, preset: ${preset}` : ''})`);
