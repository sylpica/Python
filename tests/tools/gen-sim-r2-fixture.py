"""第2ラウンド監査の指摘30件の最小再現を CPython で実行し、tests/fixtures/sim-cpython-r2.json を作る。
各ケース: 出力・例外の型・最終的な変数の repr（関数・モジュールを除く）。 python3 tests/tools/gen-sim-r2-fixture.py"""
import io, json, contextlib, sys, os
CASES = [
 ('F01-genexp-next', 'g = (x for x in range(3))\nnext(g)\nprint(list(g))\nprint(list(g))'),
 ('F02-genexp-var', 'gen = (x * x for x in range(4))\nprint(next(gen))\nprint(next(gen))\nn = len(list(gen))'),
 ('F03-str-bigint', 's = str(10**50)\nprint(s[:5], len(s))'),
 ('F04-str-mathpi', 'import math\nprint(str(math.pi)[:4], math.pi, math.tau, math.e, math.inf, -math.inf)\nr = round(math.pi, 3)'),
 ('F05-round-huge', 'x = round(1e308)\nprint(x == 1, round(1e16), round(2.5e15))'),
 ('F06-slice-assign', 'x = [1, 2, 3]\nx[1:2] = []\nprint(x)\ny = [1, 2, 3]\ny[5:] = [9]\ny[:0] = [0]\nprint(y)'),
 ('F07-slice-ext-del', 'a = [1, 2, 3, 4, 5]\na[1:3] = [9]\ndel a[0]\na.insert(-1, 7)\nz = [1, 2, 3, 4]\nz[::2] = [0, 0]\nw = list(range(6))\ndel w[::2]\nprint(a, z, w)'),
 ('F08-dict-key-eq', 'd = {1: "a", True: "b", 1.0: "c"}\ne = {0: "a", False: "b"}\nprint(d, len(d), e)'),
 ('F09-dict-update', 'd = {}\nd.update(a=1, b=2)\nd.update([("c", 3)])\nd.update({"a": 0}, z=9)\nprint(d)'),
 ('F10-count-empty', 'print("abc".count(""), "".count(""), "abc".count("", 1), "abcabc".count("bc", 2))'),
 ('F11-set-order-int', 's = {3, 1, 2}\ns.add(5)\nt = set([3, 1])\nprint(s, t, {0, 7, 4})'),
 ('F12-set-order-str', 'u = set("ab")\nprint(sorted(u), len(u))'),
 ('F13-float-index', 'print("abc"[0.5])'),
 ('F14-float-chr', 'print(chr(2.5))'),
 ('F15-int-base-nonstr', 'print(int(2, 3))'),
 ('F16-int-base-range', 'print(int("1", 1))'),
 ('F17-count-type', 'print("abc".count(1))'),
 ('F18-pop-type', 'print([1, 2].pop("a"))'),
 ('F19-pop-arity', 'print([1, 2].pop(0, 0))'),
 ('F20-type-builtin', 'print(type(len), type(int), type(print).__name__)'),
 ('E01-split-args', 'print("a b c".split(" ", 1), "ab".split(None), "x y z".rsplit(None, 1), "a1b1c".rsplit("1", 1), "  a  b ".split(None, 1), "a,b".split(sep=","))'),
 ('E02-strip-chars', 'print("xxhixx".strip("x"), "--a--".lstrip("-"), "--a--".rstrip("-"), "abcba".strip("ab"), " a ".strip(None))'),
 ('E03-start-args', 'print([1, 2, 3, 2].index(2, 2), "banana".index("a", 2), "abc".find("x", -3), "banana".count("a", 2), "ab".startswith("b", 1), "banana".rfind("a"), "abc".endswith(("c", "z")))'),
 ('E04-dict-unpack', 'd = {"a": 1}\nprint({**d, "b": 2, **{"a": 3}}, [*range(3), *"ab"], {*[1, 1]})'),
 ('E05-bool-int', 'x = [1, 2]\nprint(abs(True), hex(True), bin(True), oct(False), x[True], x[-True], bool(), chr(True))'),
 ('C01-chr-range', 'print(chr(-1))'),
 ('C02-chr-big', 'print(chr(1114112))'),
 ('M01-dict-size', 'd = {"a": 1}\nfor k in d:\n    d["b"] = 2'),
 ('M02-str-attr', 'print("abc".foo)'),
 ('M02b-list-method', '[1].push(2)'),
 ('M03-max-empty', 'print(max())'),
 ('M04-tuple-index', 'print([1, 2, 3][1, 2])'),
 ('M05-huge-float-index', 'print([1, 2, 3][1e308])'),
 ('M06-math-sqrt', 'import math\nprint(math.sqrt(16), math.floor(-2.5), math.ceil(2.1))\nprint(math.sqrt(-1))'),
 ('X01-iter-next', 'it = iter([1, 2, 3])\nprint(next(it), list(it), next(it, "end"))'),
 ('X02-set-loop-int', 'for v in {2, 0, 1}:\n    print(v)'),
]
out = []
for cid, code in CASES:
    buf = io.StringIO(); g = {}; err = None
    try:
        with contextlib.redirect_stdout(buf): exec(compile(code, '<s>', 'exec'), g)
    except BaseException as e: err = type(e).__name__
    vs = {k: repr(v) for k, v in g.items() if not k.startswith('__') and not callable(v) and type(v).__name__ not in ('module', 'generator', 'list_iterator')}
    o = buf.getvalue().split('\n')
    if o and o[-1] == '': o.pop()
    out.append({'id': 'r2:' + cid, 'code': code, 'out': o, 'err': err, 'vars': vs})
p = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'sim-cpython-r2.json')
json.dump({'python': sys.version.split()[0], 'cases': out}, open(p, 'w'), ensure_ascii=False, indent=1)
print(len(out), 'cases ->', p)
