// Regression checks (run: node tests/verify.mjs) - data & link integrity, executed with local Python 3.
import { LESSONS } from '../data/lessons.js';
import { QUIZZES } from '../data/quizzes.js';
import { REFERENCE } from '../data/reference.js';
import { GLOSSARY } from '../data/glossary.js';
import { MISTAKES } from '../data/extras.js';
import { TEMPLATES } from '../data/templates.js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
let fails = [];
function runPy(code, input = '') {
  fs.writeFileSync('/tmp/verify_t.py', code);
  try { return { out: execFileSync('python3', ['/tmp/verify_t.py'], { input, encoding: 'utf8', timeout: 10000 }).replace(/\n$/, '') }; }
  catch (e) { return { err: String(e.stderr || e).slice(0, 200) }; }
}
for (const l of LESSONS) { const r = runPy(l.code); if (r.err) fails.push(`lesson ${l.id} ERROR`); else if (r.out !== l.expected.replace(/\n$/, '')) fails.push(`lesson ${l.id} output mismatch`); }
for (const r of REFERENCE) { const x = runPy(r.example, r.id === 'input' ? 'タロウ\n' : ''); if (x.err) fails.push(`ref ${r.id} ERROR`); else if (x.out !== r.expected.replace(/\n$/, '')) fails.push(`ref ${r.id} output mismatch`); }
const tids = new Set(GLOSSARY.map(g => g.id)), rids = new Set(REFERENCE.map(r => r.id)), lids = new Set(LESSONS.map(l => l.id));
for (const l of LESSONS) { for (const t of l.terms || []) if (!tids.has(t)) fails.push(`lesson ${l.id} bad term ${t}`); for (const r of l.refs || []) if (!rids.has(r)) fails.push(`lesson ${l.id} bad ref ${r}`); }
for (const r of REFERENCE) { for (const x of r.related || []) if (!rids.has(x)) fails.push(`ref ${r.id} bad related`); if (r.lesson && !lids.has(r.lesson)) fails.push(`ref ${r.id} bad lesson`); }
for (const g of GLOSSARY) for (const x of g.related || []) if (!tids.has(x)) fails.push(`gloss ${g.id} bad related`);
for (const m of MISTAKES) { for (const x of m.related || []) if (!tids.has(x)) fails.push(`mistake ${m.id} bad related`); const g = runPy(m.good, '20\n'); if (g.err) fails.push(`mistake ${m.id} good code ERROR`); }
const pos = [0, 0, 0, 0];
for (const q of QUIZZES) { pos[q.answer]++; if (q.options.length !== 4) fails.push(`quiz ${q.id} options!=4`); if (!q.lesson || !lids.has(q.lesson)) fails.push(`quiz ${q.id} bad lesson link`); }
const spread = Math.max(...pos) - Math.min(...pos);
if (spread > 2) fails.push(`quiz answer position spread too large: ${pos}`);
for (const t of TEMPLATES) {
  const r = runPy(t.code);
  if (r.err || r.out !== t.expected) fails.push(`template ${t.id} output mismatch: got ${JSON.stringify(r.out || r.err)}`);
  if (!t.explain || !t.file) fails.push(`template ${t.id} missing explain/file`);
}
console.log(`lessons=${LESSONS.length} quizzes=${QUIZZES.length} reference=${REFERENCE.length} glossary=${GLOSSARY.length} mistakes=${MISTAKES.length} templates=${TEMPLATES.length} positions=${pos.join('/')}`);
if (fails.length) { console.log('FAIL:\n' + fails.join('\n')); process.exit(1); }
console.log('ALL CHECKS PASS');
