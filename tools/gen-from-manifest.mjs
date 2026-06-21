// Parallel texture generation from design-system/textures-manifest.json.
// Phase 1: albedos (gpt-image-2). Phase 2: emissives (--ref albedo). Phase 3: derive maps.
// Concurrency pool + per-job retry. Usage: node tools/gen-from-manifest.mjs [manifest.json]
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const manifestPath = process.argv[2] || 'design-system/textures-manifest.json';
const { materials } = JSON.parse(readFileSync(manifestPath, 'utf8'));
const M = 'assets/materials';
const SIZE = '1024x1024';
const CONC = Number(process.env.CONC || 3);
const G = 'tools/gen-image.mjs';

function run(cmd, args) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('close', (code) => res(code ?? 1));
  });
}
async function runRetry(cmd, args, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const code = await run(cmd, args);
    if (code === 0) return 0;
    const wait = (i + 1) * 10000;
    console.error(`[retry] ${args.join(' ').slice(0, 60)}… exit ${code}, attempt ${i + 1}/${tries}, wait ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  return 1;
}
function promptFile(id, kind, text) {
  const f = join(tmpdir(), `exo-prompt-${id}-${kind}.txt`);
  writeFileSync(f, text);
  return f;
}
function ok(path) { return existsSync(path) && statSync(path).size > 1000; }

async function pool(items, conc, worker) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; await worker(items[i], i); }
  });
  await Promise.all(workers);
}

console.log(`### ${materials.length} materials, concurrency ${CONC}`);

console.log('### phase 1: albedos');
await pool(materials, CONC, async (m) => {
  mkdirSync(`${M}/${m.id}`, { recursive: true });
  const out = `${M}/${m.id}/albedo.png`;
  const pf = promptFile(m.id, 'albedo', m.albedo);
  const code = await runRetry('node', [G, '--prompt-file', pf, '--out', out, '--size', SIZE, '--quality', 'high', '--model', 'gpt-image-2']);
  console.log(code === 0 && ok(out) ? `  [ok] albedo ${m.id}` : `  [FAIL] albedo ${m.id}`);
});

console.log('### phase 2: emissives (ref = albedo)');
await pool(materials.filter((m) => m.emissive), CONC, async (m) => {
  const albedo = `${M}/${m.id}/albedo.png`;
  if (!ok(albedo)) { console.log(`  [skip] emissive ${m.id} (no albedo)`); return; }
  const out = `${M}/${m.id}/emissive.png`;
  const pf = promptFile(m.id, 'emissive', m.emissive);
  const code = await runRetry('node', [G, '--prompt-file', pf, '--out', out, '--ref', albedo, '--size', SIZE, '--quality', 'high', '--model', 'gpt-image-2']);
  console.log(code === 0 && ok(out) ? `  [ok] emissive ${m.id}` : `  [FAIL] emissive ${m.id}`);
});

console.log('### phase 3: derived data maps');
await pool(materials, 4, async (m) => {
  const albedo = `${M}/${m.id}/albedo.png`;
  if (!ok(albedo)) { console.log(`  [skip] derive ${m.id} (no albedo)`); return; }
  const d = m.derive;
  const args = ['tools/derive_maps.py', albedo, `${M}/${m.id}`, '--maps', d.maps,
    '--rough-base', String(d.roughBase), '--rough-var', String(d.roughVar), '--normal-strength', String(d.normalStrength)];
  if (d.metal != null) args.push('--metal', String(d.metal));
  await run('python3', args);
  console.log(`  [ok] derive ${m.id}`);
});

console.log('ARCHETYPE TEXTURES DONE');
