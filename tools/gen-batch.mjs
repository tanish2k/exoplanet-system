// Generic parallel gpt-image batch runner. Reads a JSON array of jobs:
//   [{ prompt, out, size?, quality?, ref? }, ...]
// Concurrency pool + per-job retry. Usage: node tools/gen-batch.mjs <jobs.json>
import { readFileSync, mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const CONC = Number(process.env.CONC || 3);
const G = 'tools/gen-image.mjs';

const run = (cmd, args) => new Promise((res) => {
  const p = spawn(cmd, args, { stdio: 'inherit' });
  p.on('close', (c) => res(c ?? 1));
});
async function runRetry(cmd, args, tries = 3) {
  for (let i = 0; i < tries; i++) {
    if (await run(cmd, args) === 0) return 0;
    await new Promise((r) => setTimeout(r, (i + 1) * 10000));
  }
  return 1;
}
const ok = (p) => existsSync(p) && statSync(p).size > 1000;
async function pool(items, conc, worker) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (i < items.length) { const j = i++; await worker(items[j]); }
  }));
}

console.log(`### ${jobs.length} jobs, concurrency ${CONC}`);
await pool(jobs, CONC, async (j) => {
  mkdirSync(dirname(j.out), { recursive: true });
  const pf = join(tmpdir(), 'job-' + j.out.replace(/[^a-z0-9]/gi, '_') + '.txt');
  writeFileSync(pf, j.prompt);
  const args = [G, '--prompt-file', pf, '--out', j.out, '--size', j.size || '1024x1024', '--quality', j.quality || 'high', '--model', 'gpt-image-2'];
  if (j.ref) args.push('--ref', j.ref);
  const code = await runRetry('node', args);
  console.log(code === 0 && ok(j.out) ? `[ok] ${j.out}` : `[FAIL] ${j.out}`);
});
console.log('BATCH DONE');
