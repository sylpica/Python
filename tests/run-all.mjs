// Runs every suite and prints one summary. Exit code 1 if anything failed.
import { spawnSync } from 'node:child_process';
const suites = [['core', 'core.test.mjs'], ['engine', 'engine.test.mjs'], ['content', 'content.test.mjs'], ['sim', 'sim.test.mjs'], ['simcpy', 'sim.cpython.test.mjs'], ['e2e', 'e2e.smoke.mjs'], ['offline', 'e2e.offline.mjs']].filter(([n]) => !(process.env.SKIP || '').split(',').includes(n));
let bad = 0;
for (const [name, file] of suites) {
  const r = spawnSync('node', [file], { cwd: new URL('.', import.meta.url).pathname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const line = (r.stdout.match(/total=\d+ pass=\d+ fail=\d+ skip=\d+/g) || ['(no summary)']).pop();
  console.log(`${name.padEnd(8)} ${line}  exit=${r.status}`); if (r.status !== 0) { bad++; console.log(r.stdout.split('\n').filter(l => /FAIL|expected/.test(l)).join('\n')); }
}
process.exit(bad ? 1 : 0);
