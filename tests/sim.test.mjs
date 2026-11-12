// コード説明エンジン（lib/sim.js）の回帰テスト。CPython と一致すべき出力・例外種別を固定する。
// node tests/sim.test.mjs
import { createRequire } from 'node:module';
import { test, eq, ok, summary } from './lib/mini-test.mjs';
const require = createRequire(import.meta.url);
const { simulatePython } = require('../lib/sim.js');

const out = (code) => simulatePython(code).output;
const errs = (code) => simulatePython(code).diags.filter(d => d.level === 'error');

await test('基本の計算と表示', async () => { eq(out('x = 5\nprint(x * 2)'), ['10']); });
await test('負の剰余・切り捨て除算は Python の符号規則', async () => { eq(out('print(7 // 2, -7 // 2, 7 % 3, -7 % 3)'), ['3 -4 1 2']); });
await test('float は 3.0 のように表示', async () => { eq(out('print(3.0, 10 / 5)'), ['3.0 2.0']); });
await test('型エラーは TypeError', async () => { eq(errs('print("a" + 1)')[0].kind, 'TypeError'); });
await test('未定義変数は NameError', async () => { eq(errs('print(y)')[0].kind, 'NameError'); });
await test('0除算は ZeroDivisionError', async () => { eq(errs('x = 1 / 0')[0].kind, 'ZeroDivisionError'); });
await test('添字範囲外は IndexError', async () => { eq(errs('a = [1]\nprint(a[3])')[0].kind, 'IndexError'); });
await test('キー無しは KeyError', async () => { eq(errs('d = {}\nprint(d["k"])')[0].kind, 'KeyError'); });
await test('変換失敗は ValueError', async () => { eq(errs('print(int("12a"))')[0].kind, 'ValueError'); });
await test('括弧の閉じ忘れは SyntaxError', async () => { eq(errs('x = (1 + 2')[0].kind, 'SyntaxError'); });
await test('インデント不足は IndentationError', async () => { eq(errs('if True:\nprint("x")')[0].kind, 'IndentationError'); });
await test('無限ループは検出して止める', async () => { ok(errs('while True:\n    pass').some(d => d.kind === '無限ループの疑い')); });
await test('input() の値は捏造せず伝播', async () => { const r = simulatePython('n = input()\nprint(n)'); eq(r.diags.filter(d => d.level === 'error').length, 0); eq(r.output.length, 1); });
await test('再帰（階乗）', async () => { eq(out('def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\nprint(fact(5))'), ['120']); });
await test('入れ子関数のクロージャ', async () => { eq(out('def outer():\n    x = 1\n    def inner():\n        return x + 1\n    return inner()\nprint(outer())'), ['2']); });
await test('連鎖代入と型注釈つき代入', async () => { eq(out('a = b = 5\nx: int = 3\nprint(a, b, x)'), ['5 5 3']); });
await test('f文字列の書式（幅・精度）', async () => { eq(out('x = 42\nprint(f"{x:>6}|{3.14159:.1f}")'), ['    42|3.1']); });
await test('any/all の空判定', async () => { eq(out('print(any([]), all([]))'), ['False True']); });
await test('丸括弧つき分割代入', async () => { eq(out('for i, (a, b) in enumerate(zip([1], ["x"])):\n    print(i, a, b)'), ['0 1 x']); });
await test('対応外（class）は正直に注記し、後続は続ける', async () => { const r = simulatePython('class A:\n    pass\nprint("done")'); eq(r.output, ['done']); ok(r.diags.some(d => d.level === 'note' && d.kind === '対応外')); });
await test('壊れた入力でも例外を投げず診断を返す', async () => { for (const c of ['x = (', 'def f(', 'print("', 'a = {', 'x = * 2', 'for x in']) { const r = simulatePython(c); ok(Array.isArray(r.diags), c); } });
await test('最終状態に変数と型が出る', async () => { const r = simulatePython('a = [1, 2]\nb = "x"'); eq(r.vars.map(v => v.name + ':' + v.type).join(','), 'a:list,b:str'); });
await test('*args / **kwargs / キーワード専用引数', async () => { eq(out('def total(*args, start=0):\n    return start + sum(args)\nprint(total(1, 2, 3), total(10, 20, start=5))'), ['6 35']); eq(out('def t(*args, **kw):\n    return sum(args) + sum(kw.values())\nprint(t(1, 2, bonus=10))'), ['13']); });
await test('ジェネレータ式を引数に渡せる', async () => { eq(out('print(sum(x * x for x in range(4)))'), ['14']); });
await test('type().__name__ と __annotations__', async () => { eq(out('print(type(20).__name__, type(1.5).__name__)'), ['int float']); eq(out('def d(x: int) -> int:\n    return x\nprint(d.__annotations__)'), ["{'x': <class 'int'>, 'return': <class 'int'>}"]); });
await test('try/except は対応外として注記し、後続を止めない', async () => { const r = simulatePython('try:\n    x = 1\nexcept:\n    x = 2\nprint("after")'); eq(r.output, ['after']); ok(r.diags.some(d => d.kind === '対応外')); });
await test('デコレータ行と型注釈つき def', async () => { eq(out('def deco(f):\n    return f\n@deco\ndef g(x: int) -> int:\n    return x + 1\nprint(g(41))'), ['42']); });
summary('sim ');
