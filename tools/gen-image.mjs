// OpenAI image generation/edit helper for the exoplanet design system.
//
// Key is read from ~/.openclaw/openclaw.json (the `openai-image-gen` entry) or the
// OPENAI_API_KEY env var. The key is never printed.
//
// Generate:
//   node tools/gen-image.mjs --prompt-file <f> --out <png> [--size 2560x1440]
//        [--quality high] [--model gpt-image-2]
// Edit with reference image(s) (for style/character consistency):
//   node tools/gen-image.mjs --prompt-file <f> --out <png> --ref a.png,b.png ...
//
// Sizes (gpt-image-2): edges multiple of 16, ratio <=3:1, <=2560x1440 recommended.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

const model = opt('model', 'gpt-image-2');
const size = opt('size', '2560x1440');
const quality = opt('quality', 'high');
const out = opt('out', join(tmpdir(), 'gen.png'));
const promptFile = opt('prompt-file', null);
const promptInline = opt('prompt', null);
const refs = (opt('ref', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const prompt = promptFile ? readFileSync(promptFile, 'utf8') : promptInline;
if (!prompt) { console.error('need --prompt-file or --prompt'); process.exit(1); }

function getKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const cfg = JSON.parse(readFileSync(join(homedir(), '.openclaw/openclaw.json'), 'utf8'));
  let found = null;
  (function walk(o) {
    if (!o || typeof o !== 'object' || found) return;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'openai-image-gen' && v && v.apiKey) { found = v.apiKey; return; }
      walk(v);
    }
  })(cfg);
  if (!found) throw new Error('openai-image-gen apiKey not found in openclaw.json');
  return found;
}

const key = getKey();
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 300000);
const t0 = Date.now();

let res;
if (refs.length) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('n', '1');
  for (const p of refs) {
    form.append('image[]', new Blob([readFileSync(p)], { type: 'image/png' }), basename(p));
  }
  console.log(`editing from ${refs.length} ref(s) -> ${model} ${size} ${quality}`);
  res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: ctrl.signal,
  });
} else {
  console.log(`generating -> ${model} ${size} ${quality}`);
  res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
    signal: ctrl.signal,
  });
}
clearTimeout(timer);

const j = await res.json();
if (!res.ok) {
  console.error('API error', res.status);
  console.error(JSON.stringify(j, null, 2).slice(0, 2000));
  process.exit(1);
}
const item = j.data?.[0];
if (item?.b64_json) writeFileSync(out, Buffer.from(item.b64_json, 'base64'));
else if (item?.url) {
  const img = await fetch(item.url);
  writeFileSync(out, Buffer.from(await img.arrayBuffer()));
} else { console.error('no image in response', JSON.stringify(j).slice(0, 800)); process.exit(1); }

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`wrote ${out} in ${secs}s`);
if (j.usage) console.log('usage:', JSON.stringify(j.usage));
