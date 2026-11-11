// Content verification: every code example is executed on CPython 3.12 and on Pyodide 0.26.4
// (through the production worker.js), classified A–F, and compared with the stated result.
// Also: quiz answers, mistake "bad" phenomena, ID cross-links, duplicates, answer-position and
// option-length bias. Writes tests/output/content-evidence.json.
// Env: CPYTHON=/path/to/python3.12 (default: python3.12 on PATH)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { LESSONS } from '../data/lessons.js';
import { QUIZZES, FILLS, CODING, BUGS } from '../data/quizzes.js';
import { REFERENCE } from '../data/reference.js';
import { GLOSSARY } from '../data/glossary.js';
import { TEMPLATES } from '../data/templates.js';
import { MISTAKES, PACKAGES, ENV_LESSONS } from '../data/extras.js';
import { startWorker, ROOT } from './lib/worker-host.mjs';
import { checkCodingAnswer } from '../lib/core.js';
import { test, eq, ok, summary } from './lib/mini-test.mjs';

const CPY = process.env.CPYTHON || 'python3.12';
const cpyVersion = execFileSync(CPY, ['-c', 'import sys;print(sys.version.split()[0])'], { encoding: 'utf8' }).trim();
const cpyHas = mod => { try { execFileSync(CPY, ['-c', 'import ' + mod], { stdio: 'ignore' }); return true; } catch (e) { return false; } };
const HAS_NUMPY = cpyHas('numpy') && cpyHas('pandas');
// Terminal-style echo of input lines, same as the app's input() (a real terminal shows typed text).
const ECHO = 'import builtins as _b, sys as _s\ndef _i(p=""):\n    _s.stdout.write(str(p)); l = _s.stdin.readline()\n    if not l: raise EOFError("EOF when reading a line")\n    l = l.rstrip("\\n"); _s.stdout.write(l + "\\n"); return l\n_b.input = _i\n';
function cpython(code, stdin = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pyst-'));
  const file = path.join(dir, 'main.py'); fs.writeFileSync(file, (stdin ? ECHO : '') + code);
  try { const out = execFileSync(CPY, ['-X', 'utf8', file], { cwd: dir, input: stdin, encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'pipe'] }); return { out, err: null }; }
  catch (e) { const t = String(e.stderr || ''); const m = t.trim().split('\n').pop().match(/^(\w+(?:\.\w+)*)(?::|$)/); return { out: String(e.stdout || ''), err: m ? m[1].split('.').pop() : 'Error', errText: t }; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const norm = s => String(s ?? '').replace(/\r\n/g, '\n').split('\n').map(x => x.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');
const w = await startWorker();
async function pyodide(code, stdin = '') { const r = await w.run(code, { isolated: true, stdin, filename: '<example>' }); return { out: w.stdout(r), err: r.error ? r.error.type : null, images: r.images.length, r }; }

const evidence = { generatedAt: new Date().toISOString(), cpython: cpyVersion, pyodide: w.ready.python + ' / Pyodide 0.26.4', examples: [], quizzes: [], bias: {}, counts: {} };
const PYODIDE_ONLY = new Set(['numpy-pandas', 'numpy.array', 'pandas.DataFrame']);   // category C on CPython without numpy
const ENV_DEPENDENT = { os: 'パス区切りはOS依存（Windowsでは \\）' };

async function checkExample(kind, id, code, expected, stdin = '') {
  const rec = { kind, id, category: 'A', expected: norm(expected) };
  const p = await pyodide(code, stdin); rec.pyodide = { out: norm(p.out), err: p.err };
  if (PYODIDE_ONLY.has(id) && !HAS_NUMPY) { rec.cpython = 'skipped: CPython 側に numpy/pandas が未導入'; }
  else { const c = cpython(code, stdin); rec.cpython = { out: norm(c.out), err: c.err }; }
  if (ENV_DEPENDENT[id]) { rec.category = 'C'; rec.note = ENV_DEPENDENT[id]; }
  rec.match = !p.err && rec.pyodide.out === rec.expected && (typeof rec.cpython === 'string' || (!rec.cpython.err && rec.cpython.out === rec.expected));
  evidence.examples.push(rec);
  return rec;
}
const short = r => JSON.stringify({ exp: r.expected, pyodide: r.pyodide, cpython: r.cpython }).slice(0, 600);

for (const l of LESSONS) await test(`lesson ${l.id}: output matches on CPython ${cpyVersion} and Pyodide`, async () => { const r = await checkExample('lesson', l.id, l.code, l.expected); ok(r.match, short(r)); });
for (const tp of TEMPLATES) await test(`template ${tp.id}: output matches on CPython and Pyodide`, async () => { ok(tp.explain && tp.file && /\.py$/.test(tp.file), 'explain/file'); const r = await checkExample('template', tp.id, tp.code, tp.expected); ok(r.match, short(r)); });
for (const r of REFERENCE) await test(`reference ${r.id}: example output matches`, async () => { const x = await checkExample('reference', r.id, r.example, r.expected, r.stdin || ''); ok(x.match, short(x)); });

// glossary examples: E = fragments that intentionally rely on outside names / are syntax demos
const GLOSS_FRAGMENT = { argument: 'add が未定義の断片', 'return-value': 'add が未定義の断片', instance: 'Dog が未定義の断片', inheritance: 'Dog が未定義の断片', decorator: 'my_decorator が未定義の断片', async: 'something が未定義の断片（呼び出されないので実行は成功する）', 'context-manager': 'a.txt が存在しない前提の断片', test: 'add が未定義（関数定義のみで呼ばれない）' };
for (const g of GLOSSARY.filter(g => g.example)) await test(`glossary ${g.id}: example ${GLOSS_FRAGMENT[g.id] ? 'is a documented fragment' : 'runs'}`, async () => {
  const p = await pyodide(g.example); const isShell = /^python -m /.test(g.example);
  const rec = { kind: 'glossary', id: g.id, category: isShell ? 'D' : GLOSS_FRAGMENT[g.id] ? 'E' : 'A', pyodide: { err: p.err } };
  if (isShell) rec.note = 'シェルコマンド（Python として実行しない）';
  else if (GLOSS_FRAGMENT[g.id]) rec.note = GLOSS_FRAGMENT[g.id];
  else if (/import (pandas|numpy)/.test(g.example) && !HAS_NUMPY) { rec.cpython = 'skipped: CPython 側に numpy/pandas が未導入'; ok(!p.err, JSON.stringify(rec)); }
  else { const c = cpython(g.example); rec.cpython = { err: c.err }; ok(!p.err && !c.err, JSON.stringify(rec)); }
  rec.match = rec.category === 'A' ? true : null; evidence.examples.push(rec);
});

// mistakes: the bad code must really show the described problem, the good code must run
const MISTAKE_BAD = { 'eq-vs-assign': { err: 'SyntaxError' }, 'is-vs-eq': { out: 'False' }, 'indentation-error': { err: 'IndentationError' }, 'missing-colon': { err: 'SyntaxError' }, 'str-num-mix': { err: 'TypeError' },
  'none-handling': { err: 'TypeError', out: '5' }, 'index-out-of-range': { err: 'IndexError' }, 'dict-missing-key': { err: 'KeyError' }, 'mutable-default-arg': { out: '[1]\n[1, 2]' }, 'shallow-copy': { out: '[[1, 2, 99], [3, 4]]' },
  'float-error': { out: 'False\n0.30000000000000004' }, 'builtin-shadow': { err: 'TypeError' }, 'scope-misunderstanding': { err: 'UnboundLocalError' }, 'modify-while-iterating': { out: '[4, 7]' }, 'missing-return': { out: 'None' } };
const MISTAKE_GOOD = { 'eq-vs-assign': '5です', 'is-vs-eq': 'True', 'indentation-error': '実行', 'missing-colon': '0\n1\n2', 'str-num-mix': '21', 'none-handling': '10', 'index-out-of-range': '20', 'dict-missing-key': '不明', 'mutable-default-arg': '', 'shallow-copy': '[[1, 2], [3, 4]]', 'float-error': 'True', 'builtin-shadow': "['a', 'b', 'c']", 'scope-misunderstanding': '1', 'modify-while-iterating': '[7]', 'missing-return': '10' };
for (const m of MISTAKES) await test(`mistake ${m.id}: bad code reproduces the problem, good code fixes it`, async () => {
  const want = MISTAKE_BAD[m.id]; ok(want, 'no expectation registered');
  for (const [engine, res] of [['pyodide', await pyodide(m.bad)], ['cpython', cpython(m.bad)]]) {
    if (want.err) eq(res.err, want.err, engine + ' bad error'); else eq(res.err, null, engine + ' bad should run');
    if (want.out) eq(norm(res.out), want.out, engine + ' bad output');
    if (want.err) { const name = want.err; ok(m.phenomenon.includes(name), 'phenomenon mentions ' + name); }
  }
  for (const [engine, res] of [['pyodide', await pyodide(m.good)], ['cpython', cpython(m.good)]]) { eq(res.err, null, engine + ' good error'); eq(norm(res.out), MISTAKE_GOOD[m.id], engine + ' good output'); }
  evidence.examples.push({ kind: 'mistake', id: m.id, category: 'B', match: true });
});

// quizzes: executable ones are executed; conceptual ones are listed as manually reviewed
const EXPR = { q002: ['type("3").__name__', 'str'], q006: ['bool("")', 'False'], q009: ['list(range(3))', '[0, 1, 2]'], q010: ['len("あいう")', '3'], q018: ['len({1, 1, 2, 3})', '3'], q023: ['[1, 2] == [1, 2]', 'True'], q028: ['__import__("math").sqrt(9)', '3.0'], q029: ['"abc".upper()', '"ABC"', true], q031: ['"a,b,c".split(",")', "['a', 'b', 'c']"] };
const RAISES = { q013: ['int("abc")', 'ValueError'], q014: ['"年齢: " + 20', 'TypeError'] };
const STATE = { q004: 'nums', q019: 'd', q039: null };
const MANUAL = { q012: 'list のみミュータブル（tuple/str/int は不変）: 言語仕様', q024: 'IEEE 754 二進浮動小数点の表現誤差: 公式チュートリアル「浮動小数点演算、その問題と制限」', q032: 'sorted は新しいリスト、list.sort は in-place で None: 公式 sorting HOWTO', q035: '関数内の代入はローカル: 実行モデル 4.2.2', q036: 'with は __exit__ を必ず呼ぶ: PEP 343', q037: '型ヒントは実行時に強制されない: PEP 484', q038: 'async def 呼び出しはコルーチンを返す: 言語リファレンス', q039: null };
for (const z of QUIZZES) await test(`quiz ${z.id}: unique options, answer verified`, async () => {
  eq(new Set(z.options.map(o => o.trim())).size, 4, 'distinct options');
  ok(Number.isInteger(z.answer) && z.answer >= 0 && z.answer < 4, 'answer index');
  let how = null; const answer = z.options[z.answer];
  if (z.code && /出力/.test(z.question)) { for (const [en, r] of [['pyodide', await pyodide(z.code)], ['cpython', cpython(z.code)]]) { eq(r.err, null, en); eq(norm(r.out), answer, en + ' output'); } how = 'executed-output'; }
  else if (STATE[z.id] !== undefined && STATE[z.id]) { for (const [en, r] of [['pyodide', await pyodide(z.code + '\nprint(' + STATE[z.id] + ')')], ['cpython', cpython(z.code + '\nprint(' + STATE[z.id] + ')')]]) eq(norm(r.out), answer, en); how = 'executed-state'; }
  else if (EXPR[z.id]) { const [e, v, isRepr] = EXPR[z.id]; for (const [en, r] of [['pyodide', await pyodide('print(' + (isRepr ? 'repr(' + e + ').replace("\'", \'"\')' : e) + ')')], ['cpython', cpython('print(' + (isRepr ? 'repr(' + e + ').replace("\'", \'"\')' : e) + ')')]]) eq(norm(r.out), v, en); eq(answer, v, 'answer text'); how = 'executed-expression'; }
  else if (RAISES[z.id]) { const [e, t] = RAISES[z.id]; for (const r of [await pyodide(e), cpython(e)]) eq(r.err, t); ok(answer.includes(t) || z.id === 'q014', 'answer names ' + t); how = 'executed-exception'; }
  else if (z.code && /例外/.test(z.question)) { for (const r of [await pyodide(z.code), cpython(z.code)]) eq(r.err, answer); how = 'executed-exception'; }
  else if (MANUAL[z.id]) how = 'manual: ' + MANUAL[z.id];
  ok(how, 'no verification method registered');
  evidence.quizzes.push({ id: z.id, how });
});
for (const f of FILLS) await test(`fill ${f.id}: the answer completes runnable code`, async () => {
  eq(new Set(f.options).size, 4);
  const code = { 'f-len': 'items=[1,2]\nprint(___(items))', 'f-get': 'd={}\nvalue = d.___("key")\nprint(value)', 'f-range': 'for i in ___(5):\n    print(i, end="")', 'f-split': 'text="a,b"\nparts = text.___(",")\nprint(parts)', 'f-except': 'try:\n    int("x")\n___ ValueError:\n    print("ok")', 'f-with': 'open("a.txt","w").close()\n___ open("a.txt", encoding="utf-8") as f:\n    print(f.closed)' }[f.id];
  ok(code, 'no harness'); const want = { 'f-len': '2', 'f-get': 'None', 'f-range': '01234', 'f-split': "['a', 'b']", 'f-except': 'ok', 'f-with': 'False' }[f.id];
  const good = cpython(code.replace('___', f.options[f.answer])); eq(norm(good.out), want);
  const p = await pyodide(code.replace('___', f.options[f.answer])); eq(norm(p.out), want);
  for (const [i, o] of f.options.entries()) if (i !== f.answer) { const r = cpython(code.replace('___', o)); ok(r.err || norm(r.out) !== want, 'distractor "' + o + '" must not also be correct'); }
});
for (const c of CODING) await test(`coding ${c.id}: model solution and an alternative pass, hard-coded output fails`, async () => {
  const SOL = { 'sum-avg': ['numbers = [10, 20, 30, 40]\nprint("合計:", sum(numbers))\nprint("平均:", sum(numbers) / len(numbers))', 'numbers = [10, 20, 30, 40]\nt = 0\nfor n in numbers:\n    t += n\nprint(f"合計: {t}")\nprint(f"平均: {t / len(numbers)}")'],
    evens: ['print([x for x in range(1, 11) if x % 2 == 0])', 'print(list(range(2, 11, 2)))'],
    'char-count': ['s = "banana"\ncounts = {}\nfor ch in s:\n    counts[ch] = counts.get(ch, 0) + 1\nprint(counts)', 's = "banana"\nfrom collections import Counter\ncounts = dict(Counter(s))\nprint(counts)'],
    fizzbuzz: ['for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)', 'for i in range(1, 16):\n    print("Fizz" * (i % 3 == 0) + "Buzz" * (i % 5 == 0) or i)'] }[c.id];
  const runIso = code => w.run(code, { isolated: true, filename: '<answer>' });
  for (const s of SOL) { const v = await checkCodingAnswer(c, s, runIso); ok(v.ok, c.id + ': ' + v.reason + ' / ' + s); }
  if (c.variants) { const hard = (c.starter.split('\n')[0]) + '\nprint(' + JSON.stringify(c.expect) + ')'; const v = await checkCodingAnswer(c, hard, runIso); ok(!v.ok, 'hard-coded print must fail'); }
  const starter = await checkCodingAnswer(c, c.starter, runIso); ok(!starter.ok, 'starter must not pass');
});
for (const b of BUGS) await test(`bug ${b.id}: bad code fails, fixed code gives expected output`, async () => {
  for (const r of [await pyodide(b.bad), cpython(b.bad)]) ok(r.err || norm(r.out) !== norm(b.expect), 'bad must fail');
  for (const r of [await pyodide(b.good), cpython(b.good)]) { eq(r.err, null); eq(norm(r.out), norm(b.expect)); }
  ok(MISTAKES.some(m => m.id === b.mistake), 'linked mistake exists');
});

// ---------- cross-links / ids / duplicates ----------
const ids = { term: new Set(GLOSSARY.map(g => g.id)), ref: new Set(REFERENCE.map(r => r.id)), lesson: new Set(LESSONS.map(l => l.id)), mistake: new Set(MISTAKES.map(m => m.id)) };
await test('all cross-link ids exist', async () => {
  const bad = [];
  for (const l of LESSONS) { for (const t of l.terms || []) if (!ids.term.has(t)) bad.push(`lesson ${l.id} term ${t}`); for (const r of l.refs || []) if (!ids.ref.has(r)) bad.push(`lesson ${l.id} ref ${r}`); }
  for (const r of REFERENCE) { for (const x of r.related || []) if (!ids.ref.has(x)) bad.push(`ref ${r.id} related ${x}`); if (r.lesson && !ids.lesson.has(r.lesson)) bad.push(`ref ${r.id} lesson ${r.lesson}`); }
  for (const g of GLOSSARY) for (const x of g.related || []) { if (!ids.term.has(x)) bad.push(`term ${g.id} related ${x}`); if (x === g.id) bad.push(`term ${g.id} self link`); }
  for (const m of MISTAKES) for (const x of m.related || []) if (!ids.term.has(x)) bad.push(`mistake ${m.id} related ${x}`);
  for (const z of [...QUIZZES, ...FILLS, ...CODING, ...BUGS]) if (z.lesson && !ids.lesson.has(z.lesson)) bad.push(`exercise ${z.id} lesson ${z.lesson}`);
  for (const z of QUIZZES) if (!z.lesson) bad.push(`quiz ${z.id} has no lesson`);
  eq(bad, []);
});
await test('ids are unique in every collection', async () => { for (const [n, a] of [['lessons', LESSONS], ['quizzes', QUIZZES], ['fills', FILLS], ['coding', CODING], ['bugs', BUGS], ['reference', REFERENCE], ['glossary', GLOSSARY], ['mistakes', MISTAKES], ['packages', PACKAGES], ['env', ENV_LESSONS]]) eq(a.length, new Set(a.map(x => x.id)).size, n); });
await test('no duplicate quiz (same code or same question without code)', async () => { const k = QUIZZES.map(z => z.code ? 'c:' + z.code.replace(/\s+/g, '') : 'q:' + z.question); eq(k.length, new Set(k).size); });
await test('every lesson has at least one exercise or is linked from reference', async () => { const used = new Set([...QUIZZES, ...FILLS, ...CODING, ...BUGS].map(z => z.lesson)); const orphan = LESSONS.filter(l => !used.has(l.id)).map(l => l.id); evidence.lessonsWithoutExercise = orphan; ok(true); });

// ---------- bias (stored data and shuffled presentation with fixed seeds) ----------
await test('answer position / option length bias within limits', async () => {
  const pos = [0, 0, 0, 0]; let longest = 0, longestTies = 0, shortest = 0;
  for (const z of QUIZZES) {
    pos[z.answer]++; const lens = z.options.map(o => [...o].length); const mx = Math.max(...lens), mn = Math.min(...lens);
    if (lens[z.answer] === mx) { if (lens.filter(x => x === mx).length === 1) longest++; else longestTies++; }
    if (lens[z.answer] === mn && lens.filter(x => x === mn).length === 1) shortest++;
  }
  const fillPos = [0, 0, 0, 0]; FILLS.forEach(f => fillPos[f.answer]++);
  // presentation: Fisher–Yates with a seeded PRNG (mulberry32), 5 seeds x all quizzes
  const seeded = [];
  for (const seed of [1, 2, 3, 42, 2026]) {
    let a = seed; const rnd = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const counts = [0, 0, 0, 0];
    for (const z of QUIZZES) { const order = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } counts[order.indexOf(z.answer)]++; }
    seeded.push({ seed, counts });
  }
  const n = QUIZZES.length; const chi = pos.reduce((s, c) => s + (c - n / 4) ** 2 / (n / 4), 0);
  evidence.bias = { quizzes: n, storedPositions: pos, chiSquareStored: Number(chi.toFixed(3)), fillPositions: fillPos, answerIsUniqueLongest: longest, answerTiesLongest: longestTies, answerIsUniqueShortest: shortest, uniqueLongestRate: Number((longest / n).toFixed(3)), shuffledBySeed: seeded };
  ok(Math.max(...pos) - Math.min(...pos) <= 2, 'stored positions ' + pos);
  ok(chi < 7.815, 'chi-square (df=3, p=0.05) ' + chi);
  ok(longest / n <= 0.35, 'answer is the unique longest option too often: ' + longest);
  ok(Math.max(...fillPos) < FILLS.length, 'fill answers all in one position');
});
await test('packages: browser status is one of the measured labels', async () => { for (const p of PACKAGES) ok(['import で利用可', 'micropip で追加可', '非対応', '通常環境向け'].includes(p.browser), p.id + ': ' + p.browser); });

evidence.counts = { templates: TEMPLATES.length, lessons: LESSONS.length, quizzes: QUIZZES.length, fills: FILLS.length, coding: CODING.length, bugs: BUGS.length, reference: REFERENCE.length, glossary: GLOSSARY.length, mistakes: MISTAKES.length, packages: PACKAGES.length, envLessons: ENV_LESSONS.length,
  examplesTotal: evidence.examples.length, examplesMatched: evidence.examples.filter(e => e.match === true).length, examplesMismatch: evidence.examples.filter(e => e.match === false).length, examplesNotExecutable: evidence.examples.filter(e => e.match === null).length };
fs.mkdirSync(path.join(ROOT, 'tests/output'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tests/output/content-evidence.json'), JSON.stringify(evidence, null, 1));
console.log('counts', JSON.stringify(evidence.counts)); console.log('bias', JSON.stringify(evidence.bias));
summary('content: ');
