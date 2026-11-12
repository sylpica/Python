// コード説明エンジン（lib/sim.js）を、実際の CPython 3.12 の結果（tests/fixtures/sim-cpython312.json、425件）と照合する。
// 規則: (1) 具体値の行は CPython と完全一致（「（…）」で示す実行時に決まる値は、その部分を任意の文字列とみなす）
//       (2) CPython が例外で止まるとき、エンジンもその種類のエラーを出すか、実行時に決まる値・対応外として正直に示す
//       (3) CPython が正常に終わるコードを、エンジンがエラーと判定しない
//       (4) どんな入力でも例外を投げない
// node tests/sim.cpython.test.mjs
import { createRequire } from 'node:module';
import { test, ok, summary } from './lib/mini-test.mjs';
const require = createRequire(import.meta.url);
const { simulatePython } = require('../lib/sim.js');
const fx = require('./fixtures/sim-cpython312.json');
const PH = /（[^（）]*）/;
const wild = a => new RegExp('^' + a.split(PH).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\S]*') + '$');
const groups = {};
for (const c of fx.cases) { const g = c.id.includes(':') ? c.id.split(':')[0] : c.id.replace(/\d+$/, ''); (groups[g] = groups[g] || []).push(c); }
for (const [g, cs] of Object.entries(groups)) await test(`CPython ${fx.python} と一致: ${g}（${cs.length}件）`, async () => {
  const bad = [];
  for (const c of cs) {
    let s; try { s = simulatePython(c.code); } catch (e) { bad.push(c.id + ' CRASH ' + e); continue; }
    const serr = s.diags.find(d => d.level === 'error'); const notes = s.diags.some(d => d.level === 'note');
    const n = Math.max(s.output.length, c.out.length);
    for (let i = 0; i < n; i++) {
      const a = s.output[i], b = c.out[i];
      if (a === undefined) { if (!serr && !notes && !c.truncated) bad.push(`${c.id} 出力が足りない [${i}] ${JSON.stringify(b)}`); break; }
      if (b === undefined) { if (!c.truncated) bad.push(`${c.id} 余分な出力 [${i}] ${JSON.stringify(a)}`); break; }
      if (a !== b && !(PH.test(a) && wild(a).test(b))) { bad.push(`${c.id} 出力が違う [${i}] sim=${JSON.stringify(a)} cpython=${JSON.stringify(b)}`); break; }
    }
    if (c.err && serr && serr.kind !== c.err && !/無限ループ/.test(serr.kind)) bad.push(`${c.id} エラーの種類 sim=${serr.kind} cpython=${c.err}`);
    if (c.err && !serr && !notes && !s.output.some(l => PH.test(l))) bad.push(`${c.id} エラーを見逃し cpython=${c.err}`);
    if (!c.err && serr) bad.push(`${c.id} 正しいコードをエラーと判定 ${serr.kind}`);
  }
  ok(!bad.length, bad.slice(0, 8).join('\n'));
});
summary('sim-cpython ');
