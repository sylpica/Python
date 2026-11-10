// One-off content correction script (kept for audit traceability). Each fix asserts the
// old text exists exactly, so a fix can never silently apply to the wrong place.
import fs from 'node:fs';
const D = '/home/user/Python/data/';
function load(file, name){ const src = fs.readFileSync(D + file, 'utf8'); const m = src.match(new RegExp('export const ' + name + ' = (\\[[\\s\\S]*?\\n\\]);')); if (!m) throw new Error('no ' + name); return JSON.parse(m[1]); }
function save(file, parts, header = ''){ fs.writeFileSync(D + file, header + parts.map(([n, v]) => `export const ${n} = ${JSON.stringify(v, null, 1)};\n`).join('\n')); }
function fix(obj, field, oldS, newS){ if (!String(obj[field]).includes(oldS)) throw new Error(`fix failed ${obj.id}.${field}: ${oldS}`); obj[field] = obj[field].replace(oldS, newS); }
const by = (a, id) => { const x = a.find(o => o.id === id); if (!x) throw new Error('missing ' + id); return x; };

/* ---------- quizzes ---------- */
const Q = load('quizzes.js', 'QUIZZES');
fix(by(Q, 'q001'), 'explanation', '2 は余り 7%2 ではありませんし', '2 は割る数そのもの（余り 7%2 は 1）であり');
{ const q = by(Q, 'q008'); q.options[3] = 'th'; fix(q, 'explanation', 'yth は [1:4] の結果で', 'yth は [1:4]、th は [2:4] の結果で'); }
{ const q = by(Q, 'q039'); Object.assign(q, { question: '次のコードの出力はどれですか？', code: 'first, *rest = [1, 2, 3]\nprint(rest)', options: ['(2, 3)', '2', '[2, 3]', 'エラーになる'], answer: 2,
  explanation: '* を付けた代入先は残りの要素をまとめて受け取り、常にリストになります（右辺がタプルでもリスト）。したがって [2, 3] です。タプル (2, 3) にはならず、要素数が合わなくてもエラーにはなりません。' }); }
fix(by(Q, 'q042'), 'explanation', '小数第2位までの書式指定で、四捨五入されて 3.14 になります。', '小数点以下2桁で表示する書式指定で、3.14 に丸められます（丸めは2進数で表された値に対して行われるため、2.675 → 2.67 のように単純な四捨五入と異なる場合があります）。');

const FILLS = [
  { id: 'f-len', q: 'リストの長さを求める: print(___(items))', options: ['count', 'len', 'size', 'length'], answer: 1, lesson: 'lists', explain: '要素数は組み込み関数 len() で求めます。count は「特定の値の個数」を数えるメソッド、size/length は Python の組み込みにはありません。' },
  { id: 'f-get', q: '辞書でキーが無いときに None を返す: value = d.___("key")', options: ['find', 'search', 'get', 'fetch'], answer: 2, lesson: 'dict-operations', explain: 'dict.get はキーが無ければ None（または第2引数の既定値）を返します。' },
  { id: 'f-range', q: '0から4まで繰り返す: for i in ___(5):', options: ['loop', 'count', 'seq', 'range'], answer: 3, lesson: 'loops', explain: 'range(5) は 0,1,2,3,4 を順に生成します。' },
  { id: 'f-split', q: '文字列をカンマで分割する: parts = text.___(",")', options: ['split', 'cut', 'divide', 'parse'], answer: 0, lesson: 'string-methods', explain: 'str.split は区切り文字で分割してリストを返します。' },
  { id: 'f-except', q: '例外を捕まえる: ___ ValueError:', options: ['catch', 'except', 'handle', 'error'], answer: 1, lesson: 'exceptions', explain: 'Python の例外捕捉は except です。catch は Java や JavaScript などの書き方です。' },
  { id: 'f-with', q: 'ファイルを開いて自動で閉じる: ___ open("a.txt", encoding="utf-8") as f:', options: ['using', 'open', 'as', 'with'], answer: 3, lesson: 'context-manager', explain: 'with 文で開くと、ブロックを抜けたとき（例外時も含む）に自動で閉じられます。using は C# の書き方です。' },
];
const CODING = [
  { id: 'sum-avg', title: '合計と平均', desc: 'リスト numbers の合計と平均を「合計: X」「平均: Y」の2行で表示してください（numbers の中身が変わっても正しく動くように）', starter: 'numbers = [10, 20, 30, 40]\n# ここにコードを書く\n', expect: '合計: 100\n平均: 25.0', variants: [{ replace: ['numbers = [10, 20, 30, 40]', 'numbers = [3, 4, 5]'], expect: '合計: 12\n平均: 4.0' }], hint: 'sum() と len() を使います。print("合計:", ...) のようにカンマで区切ると間に空白が入ります', lesson: 'lists' },
  { id: 'evens', title: '偶数だけ抽出', desc: '1から10までの偶数だけをリストにして表示してください', starter: '# 内包表記がおすすめです\n', expect: '[2, 4, 6, 8, 10]', hint: '[x for x in range(1, 11) if x % 2 == 0]', lesson: 'comprehensions' },
  { id: 'char-count', title: '文字数カウント', desc: '文字列 s の各文字の出現回数を、最初に現れた順の辞書で表示してください', starter: 's = "banana"\ncounts = {}\n# ここにコードを書く\nprint(counts)\n', expect: "{'b': 1, 'a': 3, 'n': 2}", variants: [{ replace: ['s = "banana"', 's = "abca"'], expect: "{'a': 2, 'b': 1, 'c': 1}" }], hint: 'for 文で1文字ずつ取り出し、counts[ch] = counts.get(ch, 0) + 1 と数えます（collections.Counter を使っても構いません）', lesson: 'dict-operations' },
  { id: 'fizzbuzz', title: 'FizzBuzz（1〜15）', desc: '1から15まで、3の倍数はFizz、5の倍数はBuzz、両方の倍数はFizzBuzz、それ以外は数字を1行に1つずつ表示してください', starter: '', expect: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz', hint: '% 演算子で余りを見ます。15の倍数（両方）を最初に判定します', lesson: 'conditionals' },
];
const BUGS = [
  { id: 'eq', title: '= と == の混同', bad: 'x = 5\nif x = 5:\n    print("5です")\n', good: 'x = 5\nif x == 5:\n    print("5です")\n', expect: '5です', hint: '比較には == を使います', lesson: 'conditionals', mistake: 'eq-vs-assign' },
  { id: 'colon', title: 'コロンの付け忘れ', bad: 'for i in range(3)\n    print(i)\n', good: 'for i in range(3):\n    print(i)\n', expect: '0\n1\n2', hint: 'for 文の末尾に : が必要です', lesson: 'loops', mistake: 'missing-colon' },
  { id: 'str-num', title: '文字列と数値の混同', bad: 'age = "20"\nprint(age + 5)\n', good: 'age = "20"\nprint(int(age) + 5)\n', expect: '25', hint: 'int() で数値に変換します', lesson: 'variables-types', mistake: 'str-num-mix' },
  { id: 'indent', title: 'インデントミス', bad: 'if True:\nprint("ok")\n', good: 'if True:\n    print("ok")\n', expect: 'ok', hint: 'if の中身は字下げ（スペース4つ）します', lesson: 'conditionals', mistake: 'indentation-error' },
];
save('quizzes.js', [['QUIZZES', Q], ['FILLS', FILLS], ['CODING', CODING], ['BUGS', BUGS]], '// 演習データ。正答は tests/content.test.mjs で CPython 3.12 と Pyodide 0.26.4 の実行結果に照合しています。\n');

/* ---------- lessons ---------- */
const L = load('lessons.js', 'LESSONS');
fix(by(L, 'operators'), 'body', '% は割られる数の符号の影響を受けます。', '% の結果の符号は割る数（右側）と同じになります（-7 % 3 は 2、7 % -3 は -2）。');
fix(by(L, 'operators'), 'pitfalls', '条件で = を使うと代入式になって意図と異なる動作をします。', 'if の条件に = を書くと SyntaxError になります（Python では代入を条件に書けません。代入式 := は別の構文です）。');
fix(by(L, 'lists'), 'pitfalls', '独立したコピーが欲しい場合はcopy()を使いましょう。', '独立したコピーが欲しい場合はcopy()を使いましょう（ただし浅いコピーなので、入れ子のリストまで複製するには copy.deepcopy() が必要です）。');
fix(by(L, 'dict-set'), 'body', '辞書はキーにイミュータブルな値しか使えません。', '辞書のキーにはハッシュ可能な値（数値・文字列・タプルなど、主にイミュータブルな値）しか使えず、リストはキーにできません。');
fix(by(L, 'tuple-slice'), 'body', 'タプルは丸括弧で作る順序付きのデータで、', 'タプルはカンマで区切って作る順序付きのデータで（通常は丸括弧で囲みます）、');
{ const l = by(L, 'file-io');
  l.body = 'ファイルを扱う基本はopen()です。第1引数にパス、第2引数にモードを指定します。読み取りは r（省略時）、書き込みは w、追記は a です。with文で開くと、ブロックを抜けたとき（例外が起きた場合も）自動で閉じられるため、閉じ忘れを防げます。全体を読むにはread()、1行ずつ処理するにはファイルオブジェクトをfor文で回します。文字コードは環境差の原因になりやすいので、encoding="utf-8"を明示するのが安全です（Windowsでは省略時にUTF-8以外になることがあります）。 このアプリでは、ファイルはブラウザ内の仮想ファイルシステムに書き込まれます（端末の実際のフォルダには保存されません）。Studioで実行したプログラムが作ったファイルはファイル一覧に反映され、ダウンロードできます。書き込んだ後に読み直して確かめると、保存漏れにも気付けます。';
  l.code = 'with open("memo.txt", "w", encoding="utf-8") as f:\n    f.write("1行目\\n")\n    f.write("2行目\\n")\n\nwith open("memo.txt", encoding="utf-8") as f:\n    lines = f.read().splitlines()\nprint(len(lines))\nprint(lines[0])\n\nwith open("memo.txt", "a", encoding="utf-8") as f:\n    f.write("3行目\\n")\n\nwith open("memo.txt", encoding="utf-8") as f:\n    for line in f:\n        print(line.rstrip("\\n"))';
  l.expected = '2\n1行目\n1行目\n2行目\n3行目';
  l.refs = ['open', 'with', 'print', 'len']; }
{ const l = by(L, 'decorator'); fix(l, 'body', '標準や外部ライブラリのデコレータを使う場合は、元の関数の名前やdocstringが保持されるようfunctools.wrapsを付けるのが定石です。自作するときもこの習慣を真似ると、デバッグ時の混乱を防げます。', 'デコレータを自作するときは、ラッパー関数に @functools.wraps(func) を付けて、元の関数の名前（__name__）やdocstringを引き継ぐのが定石です。付けないと、デバッグ時やドキュメント表示で wrapper という名前に置き換わって混乱します。'); }
{ const l = by(L, 'context-manager');
  l.code = 'from contextlib import contextmanager\n\n@contextmanager\ndef tag(name):\n    print(f"<{name}>")\n    try:\n        yield\n    finally:\n        print(f"</{name}>")\n\nwith tag("p"):\n    print("中身")';
  fix(l, 'pitfalls', 'withを使わず手動でclose()すると', '@contextmanager で作るときは yield を try/finally で囲まないと、with の中で例外が起きた場合に後片付け（yield の後）が実行されません。また、withを使わず手動でclose()すると'); }
{ const l = by(L, 'async-intro'); fix(l, 'body', 'asyncio.gatherでは複数のコルーチンを並行に待てます。', 'asyncio.gatherでは複数のコルーチンを並行に待てます（結果は完了順ではなく渡した順に並びます）。なお、ブラウザ版Python（Pyodide）ではページ側のイベントループが既に動いているため、このアプリは先頭レベルの asyncio.run(…) を await として実行します。通常のPythonではasyncio.runがそのまま使われます。'); }
{ const l = by(L, 'numpy-pandas'); l.code = l.code.replace('print(list(arr * 10))', 'print((arr * 10).tolist())'); if (!l.code.includes('tolist')) throw new Error('np fix');
  fix(l, 'pitfalls', 'リストに数値を直接足すことはできませんが、', 'リストに数値を直接足すことはできませんが（TypeError）、'); }
{ const l = by(L, 'csv-files'); fix(l, 'body', 'ファイルを開くときは with を使い、文字コード（encoding）を明示するのが実務の基本です。', 'ファイルから読むときは with open("data.csv", newline="", encoding="utf-8") as f: のように開き、newline="" を指定するのが csv モジュールの公式な作法です（改行の誤変換を防ぎます）。Excelで保存したCSVは encoding="utf-8-sig"（BOM付き）や cp932 のことがあります。'); }
fix(by(L, 'sets-operations'), 'pitfalls', 'そのまま表示すると並びが不定です。', 'そのまま表示したときの並びは保証されません（実行環境や要素によって変わり得ます）。');
save('lessons.js', [['LESSONS', L]]);

/* ---------- reference ---------- */
const R = load('reference.js', 'REFERENCE');
const doc = (id, url) => { by(R, id).doc = 'https://docs.python.org/ja/3.12/' + url; };
by(R, 'print').syntax = "print(*objects, sep=' ', end='\\n', file=None, flush=False)";
by(R, 'print').args = 'objects: 表示する値（複数可）、sep: 値の間の区切り、end: 末尾に付ける文字、file: 出力先（既定は標準出力）、flush: すぐに書き出すか';
by(R, 'min').syntax = 'min(iterable, *, key=None)\nmin(iterable, *, default, key=None)\nmin(arg1, arg2, *args, key=None)';
by(R, 'min').args = 'iterable: 比較可能な要素の集まり（または複数の値を直接渡す）、key: 比較に使う値を取り出す関数、default: 空のときに返す値';
fix(by(R, 'min'), 'pitfalls', '空のイテラブルを渡すと ValueError。', '空のイテラブルを渡すと ValueError（default を指定すればその値を返す）。');
by(R, 'max').syntax = 'max(iterable, *, key=None)\nmax(iterable, *, default, key=None)\nmax(arg1, arg2, *args, key=None)';
by(R, 'max').args = 'iterable: 比較可能な要素の集まり（または複数の値を直接渡す）、key: 比較に使う値を取り出す関数、default: 空のときに返す値';
fix(by(R, 'max'), 'pitfalls', '空のイテラブルを渡すと ValueError。', '空のイテラブルを渡すと ValueError（default を指定すればその値を返す）。');
by(R, 'abs').returns = '絶対値（整数・浮動小数点数は同じ型、複素数では大きさを float で返す）';
by(R, 'open').syntax = "open(file, mode='r', buffering=-1, encoding=None, errors=None, newline=None, closefd=True, opener=None)";
by(R, 'open').args = "file: パス、mode: 'r' 読込／'w' 書込（上書き）／'a' 追記／'x' 新規作成／'b' バイナリ、encoding: 文字コード（テキストモードのみ）、newline: 改行の扱い（csv では ''）";
{ const r = by(R, 'input'); r.stdin = 'タロウ\n'; r.expected = '名前: タロウ\nこんにちは、タロウさん';
  r.pitfalls = '戻り値は常に文字列。数値として使うには int() や float() で変換する。入力が無いと EOFError。このアプリでは実行前に「標準入力」欄へ1行ずつ値を書いておき、読み込んだ値はターミナルと同じようにプロンプトの後ろに表示される（この例では「タロウ」を入力済みとして実行する）。'; }
fix(by(R, 'str.join'), 'pitfalls', 'sum() での文字列連結より高速で推奨される。', 'sum() は文字列の連結には使えない（TypeError）。+ を繰り返して連結するより効率がよい。');
fix(by(R, 'str.format'), 'pitfalls', '{} の数と引数の数が合わないと IndexError。', '{} に対して引数が足りないと IndexError（多すぎる引数は無視される）。');
by(R, 'dict.get').syntax = 'dict.get(key, default=None, /)';
fix(by(R, 'dict.get'), 'pitfalls', 'd["b"] のように直接参照すると無いキーで KeyError になる。', 'd["b"] のように直接参照すると無いキーで KeyError になる。引数は位置専用で、d.get("b", default=0) のようなキーワード指定は TypeError。');
fix(by(R, 'os'), 'pitfalls', 'パス区切りも環境に依存する。', 'パス区切りも環境に依存する（例の出力は Linux・macOS・ブラウザ版のもので、Windows では data\\result.csv になる）。');
const DOCS = { print: 'library/functions.html#print', len: 'library/functions.html#len', sum: 'library/functions.html#sum', min: 'library/functions.html#min', max: 'library/functions.html#max', range: 'library/stdtypes.html#range', enumerate: 'library/functions.html#enumerate', zip: 'library/functions.html#zip', sorted: 'library/functions.html#sorted', type: 'library/functions.html#type', int: 'library/functions.html#int', str: 'library/stdtypes.html#str', list: 'library/stdtypes.html#list', dict: 'library/stdtypes.html#dict', set: 'library/stdtypes.html#set', tuple: 'library/stdtypes.html#tuple', abs: 'library/functions.html#abs', round: 'library/functions.html#round', open: 'library/functions.html#open', input: 'library/functions.html#input', isinstance: 'library/functions.html#isinstance', map: 'library/functions.html#map', filter: 'library/functions.html#filter', 'str.split': 'library/stdtypes.html#str.split', 'str.join': 'library/stdtypes.html#str.join', 'str.format': 'library/stdtypes.html#str.format', 'list.append': 'tutorial/datastructures.html#more-on-lists', 'list.sort': 'library/stdtypes.html#list.sort', 'dict.get': 'library/stdtypes.html#dict.get', 'dict.items': 'library/stdtypes.html#dict.items', for: 'reference/compound_stmts.html#the-for-statement', if: 'reference/compound_stmts.html#the-if-statement', while: 'reference/compound_stmts.html#the-while-statement', with: 'reference/compound_stmts.html#the-with-statement', try: 'reference/compound_stmts.html#the-try-statement', math: 'library/math.html', random: 'library/random.html', json: 'library/json.html', os: 'library/os.html', datetime: 'library/datetime.html' };
for (const [id, u] of Object.entries(DOCS)) doc(id, u);
by(R, 'numpy.array').doc = 'https://numpy.org/doc/1.26/reference/generated/numpy.array.html';
by(R, 'pandas.DataFrame').doc = 'https://pandas.pydata.org/pandas-docs/version/2.2/reference/api/pandas.DataFrame.html';
save('reference.js', [['REFERENCE', R]]);

/* ---------- glossary ---------- */
const G = load('glossary.js', 'GLOSSARY');
fix(by(G, 'return-value'), 'misconception', 'return が無い関数はエラーのときに思われがちだが', 'return が無い関数はエラーになると思われがちだが');
by(G, 'type').example = "type(10)  # <class 'int'>";
fix(by(G, 'tuple'), 'def', '丸括弧 () で表す。', 'カンマで区切って作り、通常は丸括弧 () で囲んで表す。');
by(G, 'dict').related = ['list', 'set', 'mutable'];
by(G, 'pip').related = ['virtualenv', 'package', 'library'];
by(G, 'iterator').related = ['generator', 'list'];
by(G, 'async').related = ['function', 'exception'];
by(G, 'algorithm').related = ['iterator', 'function'];
fix(by(G, 'virtualenv'), 'misconception', '実体は本体への参照と専用のパッケージ置き場の組み合わせである。', '実体は元のPythonへの参照（OSによってはリンクや小さな起動用ファイル）と、専用のパッケージ置き場の組み合わせである。');
save('glossary.js', [['GLOSSARY', G]]);

/* ---------- mistakes / packages / env ---------- */
const M = load('extras.js', 'MISTAKES');
const P = load('extras.js', 'PACKAGES');
const E = load('extras.js', 'ENV_LESSONS');
{ const m = by(M, 'modify-while-iterating'); m.bad = 'nums = [2, 4, 6, 7]\nfor n in nums:\n    if n % 2 == 0:\n        nums.remove(n)\nprint(nums)'; m.phenomenon = '偶数を全部消したつもりが [7] ではなく [4, 7] と表示され、要素が飛ばされる。'; m.good = 'nums = [2, 4, 6, 7]\nnums = [n for n in nums if n % 2 != 0]\nprint(nums)'; }
by(M, 'eq-vs-assign').related = ['variable'];
by(M, 'str-num-mix').related = ['string', 'type'];
fix(by(M, 'scope-misunderstanding'), 'phenomenon', 'UnboundLocalError: cannot access local variable が発生する。', "UnboundLocalError: cannot access local variable 'count' where it is not associated with a value が発生する（Python 3.11 以降の文言。3.10 以前は local variable 'count' referenced before assignment）。");
by(M, 'scope-misunderstanding').good = 'count = 0\ndef inc():\n    global count\n    count += 1\ninc()\nprint(count)';
fix(by(M, 'eq-vs-assign'), 'phenomenon', 'SyntaxError になりプログラムが動かない（条件式の中で代入しようとする）。', "SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='? が発生し、プログラムが1行も実行されない。");
fix(by(M, 'indentation-error'), 'phenomenon', 'IndentationError: expected an indented block が発生する。', "IndentationError: expected an indented block after 'if' statement on line 1 が発生する。");
fix(by(M, 'none-handling'), 'phenomenon', 'None と数値の演算で TypeError になる。', "None と数値の演算で TypeError: unsupported operand type(s) for *: 'NoneType' and 'int' になる。");
fs.writeFileSync('/tmp/claude-0/-home-user-Python/a507ee63-0e37-5dae-ad11-ffb7a5ecbed2/scratchpad/extras-pending.json', JSON.stringify({ M, P, E }));
save('extras.js', [['MISTAKES', M], ['PACKAGES', P], ['ENV_LESSONS', E]]);
console.log('content fixes applied');
