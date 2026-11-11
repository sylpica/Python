// Unit tests for lib/core.js (storage normalization & migration, Markdown safety, .ipynb, grading helpers)
import { isB64, nameConflict, normalizeFiles, normalizeProgress, normalizeNotebook, renderMarkdown, explainError, nbToIpynb, ipynbToNb, validFileName, migrateKey } from '../lib/core.js';
import { QUIZZES } from '../data/quizzes.js';
import { test, eq, ok, summary } from './lib/mini-test.mjs';

await test('corrupt progress shapes never crash and keep valid entries', async () => {
  for (const bad of [null, 5, 'x', [], { lessonsDone: 'oops', history: {}, bookmarks: null }]) { const p = normalizeProgress(bad, QUIZZES); eq(Object.keys(p).sort(), ['bookmarks', 'history', 'lessonsDone', 'wrong']); ok(Array.isArray(p.history)); }
  const p = normalizeProgress({ lessonsDone: ['a', 'a', 3], history: [{ t: 'x', label: 'q012', ok: false }, null], wrong: ['q012', 'code:合計と平均'] }, QUIZZES);
  eq(p.lessonsDone, ['a']); eq(p.history, [{ t: 'x', key: 'quiz:q012', ok: false }]); eq(p.wrong, ['quiz:q012', 'code:sum-avg']);
});
await test('schema-1 keys migrate, unknown keys are preserved', async () => { eq(migrateKey('q001', QUIZZES), 'quiz:q001'); eq(migrateKey('例外を捕まえる: ___ ValueError:', QUIZZES), 'fill:f-except'); eq(migrateKey('mystery', QUIZZES), 'mystery'); });
await test('files: invalid names dropped, empty project gets main.py', async () => { eq(Object.keys(normalizeFiles({ '../x': 'a', 'ok.py': 'b', 'n': 3 })), ['ok.py']); eq(Object.keys(normalizeFiles({})), ['main.py']); eq(Object.keys(normalizeFiles('garbage')), ['main.py']); });
await test('file name validation', async () => { for (const n of ['a.py', 'データ.csv', 'pkg/mod.py', 'my file.txt']) eq(validFileName(n), null, n); for (const n of ['', '/etc/x', '../a', 'a//b', 'a\\b', 'a:b', 'x'.repeat(200)]) ok(validFileName(n), n); });
await test('notebook: schema-1 out strings are kept as output', async () => { const c = normalizeNotebook([{ type: 'code', source: 'x', out: '42\n' }, { type: 'weird', source: 1 }]); eq(c[0].output.segs[0].t, '42\n'); eq(c[1], { type: 'code', source: '' }); ok(normalizeNotebook(null).length === 2); });
await test('markdown escapes HTML and only allows http(s) links', async () => {
  const h = renderMarkdown('# T <img src=x onerror=alert(1)>\n**b** `<script>` [x](javascript:alert(1)) [ok](https://docs.python.org/)\n- a\n- b\n```\n<b>code</b>\n```');
  ok(!/<img|<script|href="javascript:/i.test(h), h); ok(h.includes('&lt;img')); ok(h.includes('<a href="https://docs.python.org/"')); ok(h.includes('<ul><li>a</li><li>b</li></ul>')); ok(h.includes('&lt;b&gt;code&lt;/b&gt;')); ok(h.includes('<h3>'));
  ok(!renderMarkdown('[x](https://a.com" onmouseover="alert(1))').includes('onmouseover="'), 'attribute break-out');
});
await test('explainError keys on the exception type', async () => { eq(explainError({ type: 'UnboundLocalError', message: '' }).mid, 'scope-misunderstanding'); eq(explainError({ type: 'SyntaxError', message: "expected ':'" }).mid, 'missing-colon'); eq(explainError({ type: 'NameError', message: "name 'TypeError' is not defined" }).mid, null); eq(explainError({ type: 'Nope' }), null); ok(explainError({ type: 'EOFError' }).text.includes('標準入力')); });
await test('.ipynb round trip keeps sources, outputs, images, counts, metadata', async () => {
  const cells = [{ type: 'markdown', source: '# T\ntext', extra: { id: 'm1', attachments: { a: 1 } } }, { type: 'code', source: 'print(1)\nx = 2\nx', count: 3, output: { segs: [{ s: 'out', t: '1\n' }], result: '2', images: ['iVBORw0KGgo='], error: null } }, { type: 'raw', source: 'raw!' }];
  const nb = nbToIpynb(cells, { custom: true }); eq(nb.nbformat, 4); eq(nb.cells[1].outputs.map(o => o.output_type), ['stream', 'display_data', 'execute_result']); eq(nb.cells[1].source, ['print(1)\n', 'x = 2\n', 'x']);
  const back = ipynbToNb(JSON.parse(JSON.stringify(nb)));
  eq(back.metadata, { custom: true }); eq(back.cells[0].source, '# T\ntext'); eq(back.cells[0].extra.attachments, { a: 1 }); eq(back.cells[1].count, 3); eq(back.cells[1].output.result, '2'); eq(back.cells[1].output.images, ['iVBORw0KGgo=']); eq(back.cells[1].output.segs, [{ s: 'out', t: '1\n' }]); eq(back.cells[2].type, 'raw');
});
await test('.ipynb from Jupyter with error output and ANSI codes', async () => { const b = ipynbToNb({ nbformat: 4, cells: [{ cell_type: 'code', source: '1/0', outputs: [{ output_type: 'error', ename: 'ZeroDivisionError', evalue: 'division by zero', traceback: ['\u001b[0;31mZeroDivisionError\u001b[0m: division by zero'] }] }] }); eq(b.cells[0].output.error.type, 'ZeroDivisionError'); ok(!b.cells[0].output.segs[0].t.includes('\u001b')); });
await test('.ipynb invalid inputs give clear errors', async () => { for (const bad of [null, {}, { cells: 'x' }, { nbformat: 3, cells: [] }, { cells: [5] }]) { let threw = false; try { ipynbToNb(bad); } catch (e) { threw = true; ok(e.message.length > 3); } ok(threw, JSON.stringify(bad)); } });
await test('error cell exports as an error output, not duplicated stderr', async () => { const nb = nbToIpynb([{ type: 'code', source: '1/0', count: 1, output: { segs: [{ s: 'err', t: 'Traceback...\nZeroDivisionError: division by zero\n' }], error: { type: 'ZeroDivisionError', message: 'division by zero', text: 'Traceback...\nZeroDivisionError: division by zero\n' }, images: [] } }]); eq(nb.cells[0].outputs.map(o => o.output_type), ['error']); });
await test('A-03 cleanOutput rebuilds broken notebook output so rendering cannot throw', async () => { for (const bad of [{ segs: 5 }, { segs: [null, 3, { t: 5 }] }, { images: 'abc' }, { images: ['<img onerror=1>'] }, { error: 'x' }, 5, 'x']) { const c = normalizeNotebook([{ type: 'code', source: 'x', output: bad }])[0]; if (c.output) { ok(Array.isArray(c.output.segs) && Array.isArray(c.output.images)); ok(c.output.images.every(i => /^[A-Za-z0-9+/=\s]*$/.test(i))); } } });
await test('A-04 binary marker is strict; look-alike text is not binary', async () => { ok(isB64('base64:AAEC/w==')); ok(isB64('base64:')); ok(!isB64('base64:hello, world!')); ok(!isB64('base64:abc')); ok(!isB64('hello')); });
await test('A-05 file/folder collisions are detected', async () => { eq(nameConflict('dd', { 'dd/x.py': '' }) !== null, true); eq(nameConflict('dd/x.py', { dd: '' }) !== null, true); eq(nameConflict('a.py', { 'b.py': '' }), null); eq(nameConflict('dd', { dd: '' }), null); });
await test('A-12 reserved object names are rejected', async () => { for (const n of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) ok(validFileName(n), n); eq(validFileName('constructors.py'), null); });
await test('A-02b markdown link with * in URL is not turned into markup', async () => { const h = renderMarkdown('[n](https://e.com/*"onmouseover=*x*)'); ok(!/<a href="[^"]*<i>/.test(h), h); ok(!/onmouseover="/.test(h)); });
summary('core: ');
