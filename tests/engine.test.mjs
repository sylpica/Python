// Engine regression tests: run the production worker.js on Pyodide 0.26.4 (Node).
// node tests/engine.test.mjs
import { startWorker } from './lib/worker-host.mjs';
import { test, eq, ok, summary } from './lib/mini-test.mjs';

const w = await startWorker();
const { run, check, reset, stdout, text } = w;

await test('ready reports protocol and Python 3.12', async () => { eq(w.ready.type, 'ready'); eq(w.ready.protocol, 3); ok(/^3\.12\./.test(w.ready.python), w.ready.python); });

// ---------- R01 output correctness ----------
await test('print(end="") output is not lost', async () => { const r = await run('print("abc", end="")'); eq(stdout(r), 'abc'); });
await test('partial line does not leak into the next run', async () => { await run('print("x", end="")'); const r = await run('print("y")'); eq(stdout(r), 'y\n'); });
await test('stdout/stderr order preserved', async () => { const r = await run('import sys\nprint("a")\nsys.stdout.flush()\nprint("b", file=sys.stderr)\nprint("c")'); eq(r.segs.map(s => s.s + ':' + s.t).join('|'), 'out:a\n|err:b\n|out:c\n'); });
await test('Unicode / emoji round trip', async () => { const r = await run('s = "日本語🐍é"\nprint(s, len(s))'); eq(stdout(r), '日本語🐍é 5\n'); });
await test('float repr like CPython', async () => { const r = await run('print(0.1 + 0.2, 1/3, 2**0.5, 10**20, 1e16)'); eq(stdout(r), '0.30000000000000004 0.3333333333333333 1.4142135623730951 100000000000000000000 1e+16\n'); });
await test('Notebook shows last expression value', async () => { const r = await run('x = 6\nx * 7', { wantLast: true }); eq(r.result, '42'); });
await test('script mode does not echo last expression', async () => { const r = await run('6 * 7'); eq(r.result, null); eq(stdout(r), ''); });
await test('trailing None expression shows nothing', async () => { const r = await run('print("p")', { wantLast: true }); eq(r.result, null); });

// ---------- R02 kernel state / namespace hygiene ----------
await test('helper imports never leak into user namespace', async () => { await reset(); const r = await run('print("json" in dir(), "io" in dir(), "ast" in dir())'); eq(stdout(r), 'False False False\n'); });
await test('using json without import is a NameError', async () => { const r = await run('json.dumps(1)'); eq(r.error && r.error.type, 'NameError'); });
await test('user names starting with _ are not clobbered', async () => { await run('_k = 5\n_out = "mine"'); const r = await run('print(_k, _out)'); eq(stdout(r), '5 mine\n'); });
await test('state persists between runs', async () => { await run('counter = 41'); const r = await run('counter += 1\nprint(counter)'); eq(stdout(r), '42\n'); });
await test('reset clears variables', async () => { await run('gone = 1'); await reset(); const r = await run('print(gone)'); eq(r.error.type, 'NameError'); });
await test('__name__ is __main__', async () => { const r = await run('print(__name__)'); eq(stdout(r), '__main__\n'); });
await test('isolated run does not touch the shared namespace', async () => { await run('shared = "studio"'); await run('shared = "lesson"', { isolated: true }); const r = await run('print(shared)'); eq(stdout(r), 'studio\n'); });
await test('isolated run cannot see Studio variables', async () => { await run('secret = 1'); const r = await run('print(secret)', { isolated: true }); eq(r.error.type, 'NameError'); });
await test('variable snapshot lists user variables only', async () => { await reset(); const r = await run('import math\na = [1, 2]\ndef f(): pass\n_hidden = 3'); eq(r.vars.map(v => v.name + ':' + v.type).join(','), 'a:list,f:function'); eq(r.vars[0].value, '[1, 2]'); eq(r.vars[0].len, 2); });

// ---------- R05 exceptions ----------
await test('traceback uses file name and hides Pyodide internals', async () => {
  const r = await run('def f(x):\n    return 1 / x\nf(0)', { filename: 'main.py' });
  eq(r.error.type, 'ZeroDivisionError'); eq(r.error.line, 2); eq(r.error.file, 'main.py');
  ok(!/_pyodide|pystudio/.test(r.error.text), r.error.text); ok(/File "main.py", line 2, in f/.test(r.error.text), r.error.text); ok(/return 1 \/ x/.test(r.error.text), 'source line shown');
});
await test('SyntaxError at runtime reports line', async () => { const r = await run('x = 1\nif x = 1:\n    pass'); eq(r.error.type, 'SyntaxError'); eq(r.error.line, 2); });
await test('exception in imported project module points at that file', async () => {
  const r = await run('import helper\nhelper.boom()', { files: { 'main.py': 'import helper\nhelper.boom()', 'helper.py': 'def boom():\n    raise ValueError("bad")\n' } });
  eq(r.error.type, 'ValueError'); eq(r.error.file, 'helper.py'); eq(r.error.line, 2);
});
await test('sys.exit(0) ends quietly, sys.exit(3) is reported', async () => { let r = await run('import sys\nprint("a")\nsys.exit(0)\nprint("b")'); eq(stdout(r), 'a\n'); eq(r.error, null); ok(r.note); r = await run('import sys\nsys.exit(3)'); eq(r.error.type, 'SystemExit'); });
await test('kernel still works after exceptions', async () => { await run('raise RuntimeError("x")'); const r = await run('print(1+1)'); eq(stdout(r), '2\n'); });
await test('RecursionError is a normal Python error', async () => { const r = await run('def f(n): return f(n+1)\nf(0)'); eq(r.error.type, 'RecursionError'); const r2 = await run('print("alive")'); eq(stdout(r2), 'alive\n'); });
await test('huge allocation fails as a Python error (wasm32: MemoryError/OverflowError)', async () => { const r = await run('x = [0] * (10**9)'); ok(['MemoryError', 'OverflowError'].includes(r.error.type), r.error.type); const r2 = await run('print("alive")'); eq(stdout(r2), 'alive\n'); });

// ---------- R06 input ----------
await test('input() reads lines in order and echoes them', async () => { const r = await run('a = input("名前: ")\nb = input()\nprint(a + b)', { stdin: 'タロウ\n花子' }); eq(stdout(r), '名前: タロウ\n花子\nタロウ花子\n'); });
await test('empty input line is an empty string', async () => { const r = await run('print(repr(input()))', { stdin: '\n' }); eq(stdout(r), '\n\'\'\n'); });
await test('missing input raises EOFError', async () => { const r = await run('input("x: ")', { stdin: '' }); eq(r.error.type, 'EOFError'); });
await test('stdin does not carry over to the next run', async () => { await run('pass', { stdin: 'left\nover' }); const r = await run('input()'); eq(r.error.type, 'EOFError'); });

// ---------- R10 / R13 files ----------
await test('multi-file import and edits are picked up', async () => {
  let r = await run('from utils import double\nprint(double(21))', { files: { 'utils.py': 'def double(x):\n    return x * 2\n' } }); eq(stdout(r), '42\n');
  r = await run('from utils import double\nprint(double(21))', { files: { 'utils.py': 'def double(x):\n    return x * 3\n' } }); eq(stdout(r), '63\n');
});
await test('deleted project file can no longer be imported', async () => { const r = await run('import utils', { files: { 'main.py': 'import utils' } }); eq(r.error.type, 'ModuleNotFoundError'); });
await test('files written by the program are reported back', async () => {
  const r = await run('with open("out.txt", "w", encoding="utf-8") as f:\n    f.write("書いた")\nopen("b.bin", "wb").write(bytes([0, 255]))', { files: { 'main.py': '' } });
  const names = r.changes.changed.map(c => c.name).sort(); eq(names.join(','), 'b.bin,out.txt');
  eq(r.changes.changed.find(c => c.name === 'out.txt').content, '書いた');
  eq(r.changes.changed.find(c => c.name === 'b.bin').content, 'base64:AP8=');
});
await test('binary upload bytes are exact (base64)', async () => { const r = await run('print(list(open("x.bin","rb").read()))', { files: { 'x.bin': 'base64:AAEC/w==' } }); eq(stdout(r), '[0, 1, 2, 255]\n'); });
await test('Shift_JIS file kept as bytes can be decoded with cp932', async () => { const r = await run('print(open("sj.txt", encoding="cp932").read())', { files: { 'sj.txt': 'base64:k/qWe4zq' } }); eq(stdout(r), '日本語\n'); });
await test('file deleted by the program is reported', async () => { const r = await run('import os\nos.remove("tmp.txt")', { files: { 'tmp.txt': 'x' } }); eq(r.changes.deleted.join(','), 'tmp.txt'); });
await test('unsafe file names are not written', async () => { const r = await run('import os\nprint(os.path.exists("/etc/evil"))', { files: { '/etc/evil': 'x', '../up': 'x' } }); eq(stdout(r), 'False\n'); });

// ---------- R04 / R25 big output ----------
await test('huge output is capped with a notice', async () => { const r = await run('for i in range(200000):\n    print(i)'); const t = text(r); ok(t.length < 420000, 'capped ' + t.length); ok(/省略しました/.test(t)); });
await test('streaming chunks are sent during long runs', async () => { const r = await run('import time\nfor i in range(3):\n    print(i)\n    t=time.time()\n    while time.time()-t < 0.2: pass', { stream: true }); ok(r.streams.length >= 2, 'streams=' + r.streams.length); });

// ---------- R07 packages ----------
await test('import in a comment/string does not load packages', async () => { const r = await run('text = "import numpy"\n# import pandas\nimport sys\nprint("numpy" in sys.modules, "pandas" in sys.modules)'); eq(stdout(r), 'False False\n'); });
await test('NumPy autoloads and computes', async () => { const r = await run('import numpy as np\nprint(np.arange(5).sum(), np.__version__)'); eq(stdout(r), '10 1.26.4\n'); });
await test('package imported only by a project module autoloads', async () => { const r = await run('import stats\nprint(stats.mean3())', { files: { 'stats.py': 'import numpy as np\ndef mean3():\n    return float(np.mean([1, 2, 3]))\n' } }); eq(stdout(r), '2.0\n'); });
await test('pandas reads a project CSV', async () => { const r = await run('import pandas as pd\ndf = pd.read_csv("s.csv")\nprint(int(df["v"].sum()))', { files: { 's.csv': 'k,v\na,1\nb,2\n' } }); eq(stdout(r), '3\n'); });
await test('matplotlib plt.show() captures a PNG without warnings', async () => { const r = await run('import matplotlib.pyplot as plt\nplt.plot([1, 2, 3])\nplt.show()'); eq(r.images.length, 1); ok(r.images[0].startsWith('iVBOR')); eq(text(r), ''); });
await test('two figures -> two images; open figure captured at end', async () => { const r = await run('import matplotlib.pyplot as plt\nplt.figure(); plt.plot([1])\nplt.figure(); plt.plot([2])\nplt.show()\nplt.figure(); plt.bar([1], [2])'); eq(r.images.length, 3); });
await test('unknown module gives ModuleNotFoundError', async () => { const r = await run('import definitely_not_a_module'); eq(r.error.type, 'ModuleNotFoundError'); });

// ---------- FINAL-B regressions ----------
await test('B-05 syntax error at runtime hides Pyodide ast.py frames', async () => { const r = await run('for i in range(3)\n    print(i)', { filename: 'main.py' }); eq(r.error.type, 'SyntaxError'); ok(!/ast\.py|_pyodide|pystudio/.test(r.error.text), r.error.text); ok(/File "main.py", line 1/.test(r.error.text), r.error.text); });
await test('B-06 missing-glyph warnings collapse into one Japanese note', async () => { const r = await run('import matplotlib.pyplot as plt\nplt.title("日本語タイトル")\nplt.plot([1, 2])\nplt.show()'); const t = w.text(r); eq((t.match(/Glyph/g) || []).length, 0, t); eq((t.match(/\[グラフ\]/g) || []).length, 1, t); eq(r.images.length, 1); });
await test('B-07 pandas pyarrow notice is not shown', async () => { const r = await run('import pandas as pd\nprint(pd.__version__)'); eq(stdout(r), '2.2.0\n'); ok(!/Pyarrow/i.test(w.text(r)), w.text(r)); });
await test('B-07 other warnings still appear', async () => { const r = await run('import warnings\nwarnings.warn("keep me")'); ok(/keep me/.test(w.text(r))); });

// ---------- asyncio ----------
await test('asyncio.run() works via top-level await shim', async () => { const r = await run('import asyncio\nasync def main():\n    await asyncio.sleep(0)\n    return 5\nprint(asyncio.run(main()))\nv = asyncio.run(main())\nprint(v)\ndef inner():\n    return asyncio.run\nprint(inner() is asyncio.run)'); eq(stdout(r), '5\n5\nTrue\n'); eq(r.asyncioShim, true); });
await test('asyncio.gather order', async () => { const r = await run('import asyncio\nasync def g(n, d):\n    await asyncio.sleep(d)\n    return n\nasync def main():\n    print(await asyncio.gather(g("a", 0.02), g("b", 0)))\nasyncio.run(main())'); eq(stdout(r), "['a', 'b']\n"); });

// ---------- R08 / R09 diagnostics ----------
const d = async code => (await check(code));
await test('syntax: missing colon line/col', async () => { const r = await d('x = 1\nif x > 0\n    print(x)'); eq(r.syntax.line, 2); eq(r.syntax.msg, "expected ':'"); });
await test('syntax: unclosed bracket is flagged incomplete', async () => { const r = await d('numbers = [\n'); eq(r.syntax.msg, "'[' was never closed"); eq(r.incomplete, true); });
await test('syntax: def calculate( incomplete', async () => { const r = await d('def calculate('); eq(r.incomplete, true); });
await test('syntax: block after if missing is incomplete', async () => { const r = await d('if condition:'); eq(r.incomplete, true); });
await test('syntax: IndentationError kind', async () => { const r = await d('if True:\nprint(1)'); eq(r.syntax.kind, 'IndentationError'); eq(r.syntax.line, 2); });
await test('syntax: unterminated string', async () => { const r = await d('s = "abc'); eq(r.syntax.line, 1); ok(/unterminated string/.test(r.syntax.msg)); eq(r.incomplete, false); });
await test('syntax: invalid assignment', async () => { const r = await d('1 = x'); ok(/cannot assign to literal/.test(r.syntax.msg)); });
await test('syntax: keyword as name', async () => { const r = await d('class = 3'); eq(r.syntax.line, 1); });
await test('syntax: second identical line reported at its own line', async () => { const r = await d('print(1)\nprint(1)\nprint(1\nx = 2'); eq(r.syntax.line, 3); });
const codes = r => r.warnings.map(x => x.code + '@' + x.line).join(',');
await test('no false positives on method calls / builtins / imports', async () => {
  const r = await d('import numpy as np\nnums = [3, 1]\nnums.append(2)\nprint(sorted(nums), np.array(nums).sum())\nclass A:\n    def __init__(self):\n        super().__init__()\n        self.v = [x for x in range(3)]\ntry:\n    raise ValueError("x")\nexcept ValueError as e:\n    print(e)\nf = lambda q: q + 1\nprint(f(1), A().v)');
  eq(codes(r), '');
});
await test('undefined name flagged at exact position', async () => { const r = await d('total = 1\nprint(totl)'); const u = r.warnings.find(x => x.code === 'undefined-name'); eq(u.line, 2); eq(u.col, 7); });
await test('mutable default / None compare / builtin shadow', async () => { const r = await d('def f(a, b=[]):\n    return a\nx = None\nprint(x == None, f(1))\nlist = [1]\nprint(list)'); eq(codes(r), 'mutable-default@1,none-compare@4,builtin-shadow@5'); });
await test('unused module-level variable is only an info hint', async () => { const r = await d('a = 1\nb = 2\nprint(a)'); eq(codes(r), 'unused@2'); eq(r.warnings[0].sev, 'info'); });
await test('kernel names suppress undefined warnings (shared kernel)', async () => { await run('kernel_var = 1'); const r = await d('print(kernel_var)'); eq(codes(r), ''); });
await test('SyntaxWarning from Python is surfaced', async () => { const r = await d('x = 5\nprint(x is 5)'); ok(r.warnings.some(w => w.code === 'syntax-warning'), codes(r)); });
await test('star import disables undefined-name guesses', async () => { const r = await d('from math import *\nprint(sqrt(4))'); eq(codes(r), ''); });

// ---------- R03 serialization inside the worker ----------
await test('concurrent requests answered with their own ids', async () => {
  const [a, b, c] = await Promise.all([run('print("A")'), check('x ='), run('print("B")')]);
  eq(stdout(a), 'A\n'); ok(c && stdout(c) === 'B\n'); ok(b.syntax);
});

summary();
