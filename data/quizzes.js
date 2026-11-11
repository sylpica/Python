// 演習データ。正答は tests/content.test.mjs で CPython 3.12 と Pyodide 0.26.4 の実行結果に照合しています。
export const QUIZZES = [
 {
  "id": "q001",
  "type": "choice",
  "category": "基礎文法",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "print(7 // 2)",
  "options": [
   "3",
   "3.5",
   "2",
   "4"
  ],
  "answer": 0,
  "explanation": "// は商の整数部分を返す切り捨て除算なので 7//2 は 3 です。3.5 は通常の / の結果、2 は割る数そのもの（余り 7%2 は 1）であり、4 は四捨五入した値でPythonの // の規則とは違います。",
  "lesson": "operators"
 },
 {
  "id": "q002",
  "type": "choice",
  "category": "データ型",
  "level": "入門",
  "question": "type(\"3\") が返す型はどれですか？",
  "options": [
   "int",
   "float",
   "str",
   "bool"
  ],
  "answer": 2,
  "explanation": "引用符で囲まれた値は中身が数字でも文字列 str です。int は引用符のない整数、float は小数、bool は True/False の型なので違います。",
  "lesson": "variables-types"
 },
 {
  "id": "q003",
  "type": "choice",
  "category": "文字列",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "print(\"ab\" * 3)",
  "options": [
   "ab3",
   "ababab",
   "abab",
   "ab ab ab"
  ],
  "answer": 1,
  "explanation": "文字列に整数を掛けると、その文字列を繰り返した新しい文字列になります。ab3 のように数字が文字として付くことはなく、繰り返し回数は3回なので abab が2回分では不足し、空白も入りません。",
  "lesson": "strings"
 },
 {
  "id": "q004",
  "type": "choice",
  "category": "リスト",
  "level": "入門",
  "question": "次のコード実行後の nums の内容はどれですか？",
  "code": "nums = [1, 2]\nnums.append(3)",
  "options": [
   "[1, 2]",
   "[3, 1, 2]",
   "[1, 2, 3, 3]",
   "[1, 2, 3]"
  ],
  "answer": 3,
  "explanation": "append() は末尾に要素を1つ追加するので [1, 2, 3] になります。変化なしは append の効果を無視しており、先頭への追加や重複追加は append の動作ではありません。",
  "lesson": "lists"
 },
 {
  "id": "q005",
  "type": "choice",
  "category": "基礎文法",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "print(7 % 3)",
  "options": [
   "2",
   "0",
   "3",
   "1"
  ],
  "answer": 3,
  "explanation": " % は余りを求める演算子で、7÷3 の余りは 1 です。2 は商、0 になるのは割り切れる場合、3 は割る数そのものなので違います。",
  "lesson": "operators"
 },
 {
  "id": "q006",
  "type": "choice",
  "category": "データ型",
  "level": "入門",
  "question": "bool(\"\") の結果はどれですか？",
  "options": [
   "True",
   "False",
   "None",
   "エラーになる"
  ],
  "answer": 1,
  "explanation": "空文字列は偽とみなされる値（falsy）なので False です。文字が入っていないため True にはならず、None は値が無いことを表す別の値で、エラーにもなりません。",
  "lesson": "variables-types"
 },
 {
  "id": "q007",
  "type": "choice",
  "category": "エラー",
  "level": "入門",
  "question": "次のコードで発生する例外はどれですか？",
  "code": "d = {\"a\": 1}\nprint(d[\"b\"])",
  "options": [
   "ValueError",
   "IndexError",
   "KeyError",
   "TypeError"
  ],
  "answer": 2,
  "explanation": "辞書に存在しないキーを [] で参照すると KeyError です。ValueError は変換失敗など、IndexError はリストや文字列の範囲外参照、TypeError は型の組み合わせが不正な場合の例外です。",
  "lesson": "dict-set"
 },
 {
  "id": "q008",
  "type": "choice",
  "category": "文字列",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "print(\"Python\"[1:3])",
  "options": [
   "yt",
   "Py",
   "yth",
   "th"
  ],
  "answer": 0,
  "explanation": "スライス [1:3] はインデックス1から2までを取り出すので yt です。Py は [0:2]、yth は [1:4]、th は [2:4] の結果で、終了位置は含まれないため範囲を取り違えた選択肢は誤りです。",
  "lesson": "tuple-slice"
 },
 {
  "id": "q009",
  "type": "choice",
  "category": "制御構文",
  "level": "入門",
  "question": "list(range(3)) の結果はどれですか？",
  "options": [
   "[0, 1, 2]",
   "[1, 2, 3]",
   "[0, 1, 2, 3]",
   "[3]"
  ],
  "answer": 0,
  "explanation": "range(3) は 0 から始まり 3 の手前までを生成するので [0, 1, 2] です。1から始まるわけではなく、終了値 3 自身も含まれません。",
  "lesson": "loops"
 },
 {
  "id": "q010",
  "type": "choice",
  "category": "文字列",
  "level": "入門",
  "question": "len(\"あいう\") の結果はどれですか？",
  "options": [
   "6",
   "9",
   "3",
   "1"
  ],
  "answer": 2,
  "explanation": "len() は文字数を数えるため、3文字で 3 です。バイト数ではないので 6 や 9 にはならず、文字列全体を1と数えることもありません。",
  "lesson": "strings"
 },
 {
  "id": "q011",
  "type": "choice",
  "category": "制御構文",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "x = 5\nif x > 3:\n    print(\"大\")\nelse:\n    print(\"小\")",
  "options": [
   "小",
   "大",
   "何も表示されない",
   "エラーになる"
  ],
  "answer": 1,
  "explanation": "x は 5 で条件 x > 3 が True なので if 側の「大」が表示されます。else は条件が False のときだけ実行され、文法にも問題はないためエラーや無表示にはなりません。",
  "lesson": "conditionals"
 },
 {
  "id": "q012",
  "type": "choice",
  "category": "データ型",
  "level": "基礎",
  "question": "次のうちミュータブル（変更可能）な型はどれですか？",
  "options": [
   "tuple",
   "str",
   "int",
   "list"
  ],
  "answer": 3,
  "explanation": "list は要素を後から変更できるミュータブルな型です。tuple、str、int はいずれもイミュータブルで、変更には新しいオブジェクトを作る必要があります。",
  "lesson": "variables-types"
 },
 {
  "id": "q013",
  "type": "choice",
  "category": "エラー",
  "level": "基礎",
  "question": "int(\"abc\") を実行したときに発生する例外はどれですか？",
  "options": [
   "KeyError",
   "TypeError",
   "SyntaxError",
   "ValueError"
  ],
  "answer": 3,
  "explanation": "数値として解釈できない文字列の変換では ValueError が発生します。KeyError は辞書、TypeError は型同士の演算などが原因で、SyntaxError は実行前の文法エラーです。",
  "lesson": "exceptions"
 },
 {
  "id": "q014",
  "type": "choice",
  "category": "エラー",
  "level": "入門",
  "question": "\"年齢: \" + 20 がエラーになる理由として正しいものはどれですか？",
  "options": [
   "数値は文字列に変換できないから",
   "文字列と数値は直接連結できないから",
   "文字列同士しか + は使えないから",
   "20が大きすぎるから"
  ],
  "answer": 1,
  "explanation": "Pythonでは str と int の + は型が合わず TypeError になります。数値は str() で変換でき、数値同士の + も可能であり、値の大きさは関係ありません。str(20) とすれば連結できます。",
  "lesson": "variables-types"
 },
 {
  "id": "q015",
  "type": "choice",
  "category": "関数",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "def f():\n    pass\nprint(f())",
  "options": [
   "0",
   "\"\"（空文字列）",
   "None",
   "エラーになる"
  ],
  "answer": 2,
  "explanation": "return を書かない関数は None を返します。pass は何もしない文であり、0 や空文字列が自動で返るわけではなく、文法として正しいためエラーにもなりません。",
  "lesson": "functions"
 },
 {
  "id": "q016",
  "type": "choice",
  "category": "関数",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "def add(a, b=10):\n    return a + b\nprint(add(5))",
  "options": [
   "15",
   "5",
   "10",
   "エラーになる"
  ],
  "answer": 0,
  "explanation": "b にはデフォルト値 10 があるため、add(5) は 5+10 で 15 です。デフォルト値が使われない 5 や、b の値だけの 10 ではなく、省略時も引数不足のエラーにはなりません。",
  "lesson": "function-arguments"
 },
 {
  "id": "q017",
  "type": "choice",
  "category": "内包表記",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "print([x * 2 for x in range(3)])",
  "options": [
   "[0, 2, 4]",
   "[2, 4, 6]",
   "[0, 1, 2]",
   "[1, 2, 3]"
  ],
  "answer": 0,
  "explanation": "range(3) は 0,1,2 で、それぞれ2倍すると [0, 2, 4] です。1から始めてしまうと [2, 4, 6] となり誤りで、元の値のままや1始まりのリストでもありません。",
  "lesson": "comprehensions"
 },
 {
  "id": "q018",
  "type": "choice",
  "category": "辞書と集合",
  "level": "入門",
  "question": "len({1, 1, 2, 3}) の結果はどれですか？",
  "options": [
   "4",
   "2",
   "3",
   "エラーになる"
  ],
  "answer": 2,
  "explanation": "集合は重複を保持しないため、1 が1つにまとめられ要素は 1,2,3 の 3 個です。書いた個数のまま 4 にはならず、重複があること自体はエラーにもなりません。",
  "lesson": "dict-set"
 },
 {
  "id": "q019",
  "type": "choice",
  "category": "辞書と集合",
  "level": "基礎",
  "question": "次のコード実行後の d の内容はどれですか？",
  "code": "d = {\"a\": 1}\nd[\"a\"] = 5\nd[\"b\"] = 2",
  "options": [
   "{'a': 1, 'b': 2}",
   "{'a': 5, 'b': 2}",
   "{'a': 5}",
   "{'a': 1, 'a': 5, 'b': 2}"
  ],
  "answer": 1,
  "explanation": "既存キーへの代入は値を上書きし、新しいキーは追加されるので {'a': 5, 'b': 2} です。同じキーは辞書内に重複して残らず、追加した b が消えることもありません。",
  "lesson": "dict-operations"
 },
 {
  "id": "q020",
  "type": "choice",
  "category": "制御構文",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)",
  "options": [
   "3",
   "10",
   "0",
   "6"
  ],
  "answer": 3,
  "explanation": "range(1,4) は 1,2,3 で合計は 6 です。3 は最後の値、10 は 4 まで含めた場合、0 はループが実行されなかった場合の値で、いずれも範囲の理解として誤りです。",
  "lesson": "loops"
 },
 {
  "id": "q021",
  "type": "choice",
  "category": "制御構文",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "n = 3\nwhile n > 0:\n    print(n, end=\"\")\n    n -= 1",
  "options": [
   "012",
   "333",
   "無限ループになる",
   "321"
  ],
  "answer": 3,
  "explanation": "n は 3 から1ずつ減り、0 になると条件が False になって終了するので 321 です。n を減らしているため無限ループにはならず、開始値や増加方向を取り違えた選択肢は誤りです。",
  "lesson": "loops"
 },
 {
  "id": "q022",
  "type": "choice",
  "category": "例外",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "try:\n    print(1 / 0)\nexcept ZeroDivisionError:\n    print(\"ゼロ除算\")",
  "options": [
   "0",
   "ゼロ除算",
   "ZeroDivisionError と表示される",
   "何も表示されない"
  ],
  "answer": 1,
  "explanation": "0で割ると ZeroDivisionError が発生し、except 節の処理が実行されます。例外名そのものが表示されるわけではなく、捕捉しているため何も表示されないこともありません。",
  "lesson": "exceptions"
 },
 {
  "id": "q023",
  "type": "choice",
  "category": "基礎文法",
  "level": "基礎",
  "question": "a = [1, 2]、b = [1, 2] のとき a == b の結果はどれですか？",
  "options": [
   "False",
   "None",
   "True",
   "エラーになる"
  ],
  "answer": 2,
  "explanation": "== は値が等しいかを比べるため、内容が同じリスト同士は True です。is は同一オブジェクトかどうかを比べる演算子であり、== と混同した False は誤りです。",
  "lesson": "operators"
 },
 {
  "id": "q024",
  "type": "choice",
  "category": "データ型",
  "level": "基礎",
  "question": "0.1 + 0.2 == 0.3 の結果が False になり得る主な理由はどれですか？",
  "options": [
   "浮動小数点数の近似表現による誤差",
   "整数化されるから",
   "== が小数を比較できないから",
   "0.1が文字列だから"
  ],
  "answer": 0,
  "explanation": "float は二進数の近似で表されるため、0.1+0.2 は 0.3 とわずかに異なる値になります。小数同士も == で比較でき、整数化や文字列化が原因ではありません。",
  "lesson": "variables-types"
 },
 {
  "id": "q025",
  "type": "choice",
  "category": "オブジェクト指向",
  "level": "中級",
  "question": "次のコードの出力はどれですか？",
  "code": "class P:\n    def __init__(self, x):\n        self.x = x\nprint(P(7).x)",
  "options": [
   "7",
   "P",
   "x",
   "エラーになる"
  ],
  "answer": 0,
  "explanation": "__init__ で self.x に代入された値がインスタンスの属性となり、P(7).x で取り出せます。クラス名や属性名そのものが表示されるわけではなく、正しい文法なのでエラーにもなりません。",
  "lesson": "class-inheritance"
 },
 {
  "id": "q026",
  "type": "choice",
  "category": "オブジェクト指向",
  "level": "中級",
  "question": "次のコードの出力はどれですか？",
  "code": "class A:\n    def greet(self):\n        return \"A\"\nclass B(A):\n    def greet(self):\n        return \"B\"\nprint(B().greet())",
  "options": [
   "A",
   "AB",
   "B",
   "エラーになる"
  ],
  "answer": 2,
  "explanation": "サブクラス B で greet を上書き（オーバーライド）しているため、B のインスタンスでは B が返ります。親クラスの A が優先されることはなく、両方が連結されることもありません。",
  "lesson": "class-inheritance"
 },
 {
  "id": "q027",
  "type": "choice",
  "category": "イテレータ",
  "level": "中級",
  "question": "次のコードの出力はどれですか？",
  "code": "def gen():\n    yield 10\n    yield 20\ng = gen()\nprint(next(g))",
  "options": [
   "20",
   "10",
   "[10, 20]",
   "ジェネレータオブジェクトの説明文"
  ],
  "answer": 1,
  "explanation": "yield を含む関数はジェネレータを返し、next() で最初の yield の値 10 が得られます。2番目の 20 は次の next() で得られ、リストとして一度に返るわけでもありません。",
  "lesson": "iterator-generator"
 },
 {
  "id": "q028",
  "type": "choice",
  "category": "モジュール",
  "level": "入門",
  "question": "import math のあと math.sqrt(9) の結果はどれですか？",
  "options": [
   "3",
   "9",
   "エラーになる",
   "3.0"
  ],
  "answer": 3,
  "explanation": "sqrt は平方根を float で返すため 3.0 です。整数の 3 ではなく float になる点がポイントで、元の値 9 が返るわけでもありません。",
  "lesson": "import-module"
 },
 {
  "id": "q029",
  "type": "choice",
  "category": "文字列",
  "level": "基礎",
  "question": "\"abc\".upper() の結果はどれですか？",
  "options": [
   "\"abc\"",
   "\"Abc\"",
   "エラーになる",
   "\"ABC\""
  ],
  "answer": 3,
  "explanation": "upper() は英字をすべて大文字にした新しい文字列を返します。元の文字列は変更されないイミュータブルな性質があり、先頭だけ大文字にする capitalize() とも異なります。",
  "lesson": "string-methods"
 },
 {
  "id": "q030",
  "type": "choice",
  "category": "文字列",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "print(\"-\".join([\"a\", \"b\", \"c\"]))",
  "options": [
   "abc",
   "a-b-c",
   "a b c",
   "['a', 'b', 'c']"
  ],
  "answer": 1,
  "explanation": "join は指定した文字列を区切りとして要素を連結するので a-b-c です。区切りなしの abc や空白区切りではなく、リストがそのまま表示されることもありません。",
  "lesson": "string-methods"
 },
 {
  "id": "q031",
  "type": "choice",
  "category": "文字列",
  "level": "基礎",
  "question": "\"a,b,c\".split(\",\") の結果はどれですか？",
  "options": [
   "\"abc\"",
   "['a,b,c']",
   "['a', 'b', 'c']",
   "('a', 'b', 'c')"
  ],
  "answer": 2,
  "explanation": "split は区切り文字で分割したリストを返します。連結した文字列や分割されていないリストではなく、丸括弧のタプルでもありません。",
  "lesson": "string-methods"
 },
 {
  "id": "q032",
  "type": "choice",
  "category": "リスト",
  "level": "基礎",
  "question": "sorted([3, 1, 2]) と、元のリストに対する sort() の違いとして正しいものはどれですか？",
  "options": [
   "sorted は新しいリストを返し、sort は元のリスト自体を変更する",
   "どちらも元のリストを変更する",
   "どちらも新しいリストを返す",
   "sort は文字列専用である"
  ],
  "answer": 0,
  "explanation": "sorted() は並べ替えた新しいリストを返して元の順序を保ちます。一方 list.sort() はそのリスト自体を書き換え None を返します。sort は数値のリストにも使えます。",
  "lesson": "list-operations"
 },
 {
  "id": "q033",
  "type": "choice",
  "category": "関数",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "def greet(name, msg=\"hi\"):\n    return f\"{msg} {name}\"\nprint(greet(msg=\"yo\", name=\"ken\"))",
  "options": [
   "yo ken",
   "hi ken",
   "ken yo",
   "エラーになる"
  ],
  "answer": 0,
  "explanation": "キーワード引数は名前で対応付けられるため、書いた順序にかかわらず msg と name に正しく渡り yo ken になります。デフォルト値 hi は明示した値で上書きされ、順序が違うこと自体はエラーになりません。",
  "lesson": "function-arguments"
 },
 {
  "id": "q034",
  "type": "choice",
  "category": "関数",
  "level": "中級",
  "question": "次のコードの出力はどれですか？",
  "code": "def total(*args):\n    return sum(args)\nprint(total(1, 2, 3, 4))",
  "options": [
   "[1, 2, 3, 4]",
   "4",
   "10",
   "エラーになる"
  ],
  "answer": 2,
  "explanation": "*args は余った位置引数をタプルにまとめ、sum で合計すると 10 です。リストとして返るわけではなく、個数の 4 でもなく、可変長引数は個数が可変でもエラーになりません。",
  "lesson": "function-arguments"
 },
 {
  "id": "q035",
  "type": "choice",
  "category": "関数",
  "level": "中級",
  "question": "関数の中で代入した変数について、正しい説明はどれですか？",
  "options": [
   "常に関数外と共有される",
   "原則としてその関数内のローカル変数になる",
   "代入した時点で自動的にグローバルになる",
   "関数内では変数を作れない"
  ],
  "answer": 1,
  "explanation": "関数内で代入した変数は原則ローカル変数で、関数外の同名変数とは別物です。global宣言なしに自動でグローバルにはならず、共有もされません。関数内でも変数は作れます。",
  "lesson": "args-scope"
 },
 {
  "id": "q036",
  "type": "choice",
  "category": "制御構文",
  "level": "上級",
  "question": "with文を使う主な利点はどれですか？",
  "options": [
   "処理が必ず高速になる",
   "例外が発生しなくなる",
   "ファイルを自動で作成し続ける",
   "ブロックを抜けるとき後片付けが自動で行われる"
  ],
  "answer": 3,
  "explanation": "with文は __exit__ により、例外時も含めてブロック終了時の後片付けを保証します。速度の保証はなく、例外の発生自体を防ぐものでも、ファイルを生成し続けるものでもありません。",
  "lesson": "context-manager"
 },
 {
  "id": "q037",
  "type": "choice",
  "category": "型",
  "level": "中級",
  "question": "型ヒントについて正しい説明はどれですか？",
  "options": [
   "型と違う値を渡すと必ず実行時エラーになる",
   "型ヒントを書くと処理が高速になる",
   "型ヒントは必須で、無いと実行できない",
   "実行時にPythonが自動で型検査する仕組みではない"
  ],
  "answer": 3,
  "explanation": "型ヒントは注釈であり、通常の実行では強制的に検査されません。そのため型と異なる値でも即エラーになるとは限らず、速度や必須性とも直接関係ありません。静的解析の助けになるのが役割です。",
  "lesson": "type-hints"
 },
 {
  "id": "q038",
  "type": "choice",
  "category": "非同期",
  "level": "上級",
  "question": "async def で定義した関数を呼び出したとき、得られるものはどれですか？",
  "options": [
   "関数の戻り値そのもの",
   "コルーチンオブジェクト",
   "実行を終えた結果",
   "スレッドオブジェクト"
  ],
  "answer": 1,
  "explanation": "async def の関数は呼び出すとコルーチンオブジェクトを返し、中身は await やタスク化で初めて進みます。戻り値そのものが即得られるわけではなく、スレッドを作る仕組みでもありません。",
  "lesson": "async-intro"
 },
 {
  "id": "q039",
  "type": "choice",
  "category": "基礎文法",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "first, *rest = [1, 2, 3]\nprint(rest)",
  "options": [
   "(2, 3)",
   "2",
   "[2, 3]",
   "エラーになる"
  ],
  "answer": 2,
  "explanation": "* を付けた代入先は残りの要素をまとめて受け取り、常にリストになります（右辺がタプルでもリスト）。したがって [2, 3] です。タプル (2, 3) にはならず、要素数が合わなくてもエラーにはなりません。",
  "lesson": "tuple-slice"
 },
 {
  "id": "q040",
  "type": "choice",
  "category": "文字列",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "x = 3\nprint(f\"{x}個\")",
  "options": [
   "3個",
   "{x}個",
   "x個",
   "エラーになる"
  ],
  "answer": 0,
  "explanation": "f文字列では波括弧内の式が評価されて文字列に埋め込まれるため 3個 です。f を付けない通常の文字列では {x} のまま表示されますが、このコードには f があるためエラーにもなりません。",
  "lesson": "strings"
 },
 {
  "id": "q041",
  "type": "choice",
  "category": "リスト",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "print([10, 20, 30, 40, 50][1:4])",
  "options": [
   "[20, 30, 40]",
   "[10, 20, 30]",
   "[20, 30, 40, 50]",
   "[10, 20, 30, 40]"
  ],
  "answer": 0,
  "lesson": "tuple-slice",
  "explanation": "スライス [1:4] はインデックス1から3まで（末尾は含まない）を取り出すので [20, 30, 40] です。開始位置を含み終了位置を含まないのがスライスの規則です。"
 },
 {
  "id": "q042",
  "type": "choice",
  "category": "文字列",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "pi = 3.14159\nprint(f\"{pi:.2f}\")",
  "options": [
   "3.14159",
   "3.1",
   "3.14",
   "エラーになる"
  ],
  "answer": 2,
  "lesson": "strings",
  "explanation": "f文字列の :.2f は小数点以下2桁で表示する書式指定で、3.14 に丸められます（丸めは2進数で表された値に対して行われるため、2.675 → 2.67 のように単純な四捨五入と異なる場合があります）。書式を指定しなければ元の値そのままが表示されます。"
 },
 {
  "id": "q043",
  "type": "choice",
  "category": "辞書と集合",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "d = {\"a\": 1}\nprint(d.get(\"b\", 0))",
  "options": [
   "KeyErrorになる",
   "None",
   "1",
   "0"
  ],
  "answer": 3,
  "lesson": "dict-operations",
  "explanation": "dict.get はキーが無いときに第2引数の既定値を返すので 0 です。d[\"b\"] と直接参照すると KeyError になりますが、get は安全に読めます。"
 },
 {
  "id": "q044",
  "type": "choice",
  "category": "リスト",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "a = [1, 2]\nb = a\nb.append(3)\nprint(a)",
  "options": [
   "[1, 2]",
   "[1, 2, 3]",
   "[3]",
   "エラーになる"
  ],
  "answer": 1,
  "lesson": "list-operations",
  "explanation": "b = a はコピーではなく同じリストへの参照の代入なので、b への追加は a にも見えます。独立したコピーが欲しい場合は a.copy() を使います。"
 },
 {
  "id": "q045",
  "type": "choice",
  "category": "関数",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "def f():\n    x = 1\nprint(f())",
  "options": [
   "1",
   "0",
   "エラーになる",
   "None"
  ],
  "answer": 3,
  "lesson": "functions",
  "explanation": "return が無い関数は None を返します。関数内で代入した x はローカル変数で、戻り値にはなりません。"
 },
 {
  "id": "q046",
  "type": "choice",
  "category": "辞書と集合",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "print(sorted({1, 2, 3} & {2, 3, 4}))",
  "options": [
   "[2, 3]",
   "[1, 2, 3, 4]",
   "[1, 4]",
   "[3]"
  ],
  "answer": 0,
  "lesson": "sets-operations",
  "explanation": "& は積集合（両方に含まれる要素）で {2, 3} となり、sorted でリスト化して [2, 3] です。和集合なら | を使います。"
 },
 {
  "id": "q047",
  "type": "choice",
  "category": "リスト",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "nums = [3, 1, 2]\nresult = nums.sort()\nprint(result, nums)",
  "options": [
   "[1, 2, 3] [1, 2, 3]",
   "None [1, 2, 3]",
   "None [3, 1, 2]",
   "[1, 2, 3] [3, 1, 2]"
  ],
  "answer": 1,
  "lesson": "list-operations",
  "explanation": "list.sort() は元のリスト自体を並べ替えて None を返します。並べ替えた新しいリストが欲しい場合は sorted(nums) を使います。"
 },
 {
  "id": "q048",
  "type": "choice",
  "category": "例外",
  "level": "中級",
  "question": "次のコードの出力はどれですか？",
  "code": "try:\n    v = 10 // 2\nexcept ZeroDivisionError:\n    print(\"err\")\nelse:\n    print(v)",
  "options": [
   "err",
   "何も表示されない",
   "5",
   "エラーになる"
  ],
  "answer": 2,
  "lesson": "exceptions-advanced",
  "explanation": "例外が起きなかったときは except ではなく else が実行されるので 5 が表示されます。else は「成功したときだけ行う処理」を置く場所です。"
 },
 {
  "id": "q049",
  "type": "choice",
  "category": "基礎文法",
  "level": "入門",
  "question": "次のコードの出力はどれですか？",
  "code": "x, y = 1, 2\nx, y = y, x\nprint(x, y)",
  "options": [
   "1 2",
   "1 1",
   "2 1",
   "エラーになる"
  ],
  "answer": 2,
  "lesson": "tuple-slice",
  "explanation": "右辺が先に評価されてタプル (2, 1) が作られ、それが x, y に展開されるため入れ替わります。一時変数なしで交換できるのが多重代入の特徴です。"
 },
 {
  "id": "q050",
  "type": "choice",
  "category": "制御構文",
  "level": "基礎",
  "question": "次のコードの出力はどれですか？",
  "code": "print(list(enumerate([\"a\", \"b\"], start=1)))",
  "options": [
   "[(0, 'a'), (1, 'b')]",
   "[(1, 'a'), (2, 'b')]",
   "['a', 'b']",
   "[1, 2]"
  ],
  "answer": 1,
  "lesson": "loops",
  "explanation": "enumerate は (番号, 要素) のペアを生成し、start=1 で番号が1から始まるので [(1, 'a'), (2, 'b')] です。"
 }
];

export const FILLS = [
 {
  "id": "f-len",
  "q": "リストの長さを求める: print(___(items))",
  "options": [
   "count",
   "len",
   "size",
   "length"
  ],
  "answer": 1,
  "lesson": "lists",
  "explain": "要素数は組み込み関数 len() で求めます。count は「特定の値の個数」を数えるメソッド、size/length は Python の組み込みにはありません。"
 },
 {
  "id": "f-get",
  "q": "辞書でキーが無いときに None を返す: value = d.___(\"key\")",
  "options": [
   "find",
   "search",
   "get",
   "fetch"
  ],
  "answer": 2,
  "lesson": "dict-operations",
  "explain": "dict.get はキーが無ければ None（または第2引数の既定値）を返します。"
 },
 {
  "id": "f-range",
  "q": "0から4まで繰り返す: for i in ___(5):",
  "options": [
   "loop",
   "count",
   "seq",
   "range"
  ],
  "answer": 3,
  "lesson": "loops",
  "explain": "range(5) は 0,1,2,3,4 を順に生成します。"
 },
 {
  "id": "f-split",
  "q": "文字列をカンマで分割する: parts = text.___(\",\")",
  "options": [
   "split",
   "cut",
   "divide",
   "parse"
  ],
  "answer": 0,
  "lesson": "string-methods",
  "explain": "str.split は区切り文字で分割してリストを返します。"
 },
 {
  "id": "f-except",
  "q": "例外を捕まえる: ___ ValueError:",
  "options": [
   "catch",
   "except",
   "handle",
   "error"
  ],
  "answer": 1,
  "lesson": "exceptions",
  "explain": "Python の例外捕捉は except です。catch は Java や JavaScript などの書き方です。"
 },
 {
  "id": "f-with",
  "q": "ファイルを開いて自動で閉じる: ___ open(\"a.txt\", encoding=\"utf-8\") as f:",
  "options": [
   "using",
   "open",
   "as",
   "with"
  ],
  "answer": 3,
  "lesson": "context-manager",
  "explain": "with 文で開くと、ブロックを抜けたとき（例外時も含む）に自動で閉じられます。using は C# の書き方です。"
 }
];

export const CODING = [
 {
  "id": "sum-avg",
  "title": "合計と平均",
  "desc": "リスト numbers の合計と平均を「合計: X」「平均: Y」の2行で表示してください（numbers の中身が変わっても正しく動くように）",
  "starter": "numbers = [10, 20, 30, 40]\n# ここにコードを書く\n",
  "expect": "合計: 100\n平均: 25.0",
  "variants": [
   {
    "replace": [
     "numbers = [10, 20, 30, 40]",
     "numbers = [3, 4, 5]"
    ],
    "expect": "合計: 12\n平均: 4.0"
   }
  ],
  "hint": "sum() と len() を使います。print(\"合計:\", ...) のようにカンマで区切ると間に空白が入ります",
  "lesson": "lists"
 },
 {
  "id": "evens",
  "title": "偶数だけ抽出",
  "desc": "1から10までの偶数だけをリストにして表示してください",
  "starter": "# 内包表記がおすすめです\n",
  "expect": "[2, 4, 6, 8, 10]",
  "hint": "[x for x in range(1, 11) if x % 2 == 0]",
  "lesson": "comprehensions"
 },
 {
  "id": "char-count",
  "title": "文字数カウント",
  "desc": "文字列 s の各文字の出現回数を、最初に現れた順の辞書で表示してください",
  "starter": "s = \"banana\"\ncounts = {}\n# ここにコードを書く\nprint(counts)\n",
  "expect": "{'b': 1, 'a': 3, 'n': 2}",
  "variants": [
   {
    "replace": [
     "s = \"banana\"",
     "s = \"abca\""
    ],
    "expect": "{'a': 2, 'b': 1, 'c': 1}"
   }
  ],
  "hint": "for 文で1文字ずつ取り出し、counts[ch] = counts.get(ch, 0) + 1 と数えます。collections.Counter を使う場合は、表示が Counter(...) にならないよう dict(Counter(s)) と変換します",
  "lesson": "dict-operations"
 },
 {
  "id": "fizzbuzz",
  "title": "FizzBuzz（1〜15）",
  "desc": "1から15まで、3の倍数はFizz、5の倍数はBuzz、両方の倍数はFizzBuzz、それ以外は数字を1行に1つずつ表示してください",
  "starter": "",
  "expect": "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
  "hint": "% 演算子で余りを見ます。15の倍数（両方）を最初に判定します",
  "lesson": "conditionals"
 }
];

export const BUGS = [
 {
  "id": "eq",
  "title": "= と == の混同",
  "bad": "x = 5\nif x = 5:\n    print(\"5です\")\n",
  "good": "x = 5\nif x == 5:\n    print(\"5です\")\n",
  "expect": "5です",
  "hint": "比較には == を使います",
  "lesson": "conditionals",
  "mistake": "eq-vs-assign"
 },
 {
  "id": "colon",
  "title": "コロンの付け忘れ",
  "bad": "for i in range(3)\n    print(i)\n",
  "good": "for i in range(3):\n    print(i)\n",
  "expect": "0\n1\n2",
  "hint": "for 文の末尾に : が必要です",
  "lesson": "loops",
  "mistake": "missing-colon"
 },
 {
  "id": "str-num",
  "title": "文字列と数値の混同",
  "bad": "age = \"20\"\nprint(age + 5)\n",
  "good": "age = \"20\"\nprint(int(age) + 5)\n",
  "expect": "25",
  "hint": "int() で数値に変換します",
  "lesson": "variables-types",
  "mistake": "str-num-mix"
 },
 {
  "id": "indent",
  "title": "インデントミス",
  "bad": "if True:\nprint(\"ok\")\n",
  "good": "if True:\n    print(\"ok\")\n",
  "expect": "ok",
  "hint": "if の中身は字下げ（スペース4つ）します",
  "lesson": "conditionals",
  "mistake": "indentation-error"
 }
];
