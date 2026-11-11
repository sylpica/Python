export const LESSONS = [
 {
  "id": "variables-types",
  "title": "変数と型",
  "level": "入門",
  "category": "基礎文法",
  "goal": "変数への代入と、int・float・str・boolなどの基本型の違いを理解する",
  "body": "変数は値に名前を付けたもので、= で代入します。代入した値によって型が決まり、type()で確認できます。主な基本型は、整数のint、小数を含むfloat、文字列のstr、真偽値のboolです。型が違えば同じ演算でも結果が変わります。たとえば数値同士の + は足し算ですが、文字列同士の + は連結になります。小数（float）は2進数で近似して保存されるため、0.1 + 0.2 は 0.30000000000000004 のようにわずかな誤差を含みます。また、0・空文字列・空のリストなどは条件式で偽（False）として扱われます。変数名は意味が分かる名前を付け、値が変わったら型も変わり得ることを意識しましょう。Pythonは代入のたびに型を固定しない動的型付け言語です。 値をprint()で表示しながら型を確認する習慣を付けると、意図しない型の混入に早く気付けます。特に外部から受け取った値は文字列になっていることが多いため、計算前に変換が必要かどうかを常に意識することが大切です。",
  "code": "age = 20\nprice = 99.5\nname = \"タロウ\"\nprint(type(age).__name__)\nprint(type(price).__name__)\nprint(age + 5)\nprint(name + \"さん\")",
  "expected": "int\nfloat\n25\nタロウさん",
  "pitfalls": "文字列と数値をそのまま + するとTypeErrorになります。数値を文字列に混ぜるときはstr()で変換するかf文字列を使いましょう。",
  "terms": [
   "variable",
   "type",
   "string"
  ],
  "refs": [
   "print",
   "type",
   "str",
   "int"
  ]
 },
 {
  "id": "operators",
  "title": "演算子",
  "level": "入門",
  "category": "基礎文法",
  "goal": "算術・比較・論理演算子の働きと、割り算の種類の違いを理解する",
  "body": "演算子は値同士の計算や比較を行う記号です。算術演算子には +、-、*、/ のほか、商の整数部分を求める //、余りを求める %、べき乗の ** があります。/ は常にfloatを返し、// とは結果が異なる点に注意が必要です。比較演算子 ==、!=、<、>= などはboolを返し、条件分岐で使われます。is は「同じオブジェクトか」、== は「値が等しいか」を調べる演算子で、通常の値の比較には == を使います。論理演算子 and、or、not を組み合わせると複数の条件を一度に判定できます。演算には優先順位があり、迷う場合は括弧で明示すると読みやすくなります。 演算結果の型にも注目しましょう。整数同士でも / では小数になり、% の結果の符号は割る数（右側）と同じになります（-7 % 3 は 2、7 % -3 は -2）。条件式を変数に代入しておくと、複雑な分岐も名前で読み解けるようになり、確認や修正がしやすくなります。",
  "code": "print(7 / 2)\nprint(7 // 2)\nprint(7 % 2)\nprint(2 ** 3)\nprint(10 > 3 and 5 < 8)",
  "expected": "3.5\n3\n1\n8\nTrue",
  "pitfalls": "= は代入、== は比較です。if の条件に = を書くと SyntaxError になります（Python では代入を条件に書けません。代入式 := は別の構文です）。",
  "terms": [
   "type"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "strings",
  "title": "文字列",
  "level": "入門",
  "category": "データ型",
  "goal": "文字列の連結、繰り返し、インデックス、スライス、代表的なメソッドを使えるようになる",
  "body": "文字列は文字の並びで、シングルクォートかダブルクォートで囲んで作ります。文字には0から始まるインデックスがあり、s[0]で先頭の文字を取り出せます。s[1:3]のようなスライスでは範囲を指定して部分文字列を得られます。文字列はイミュータブルで、直接書き換えることはできません。upper()やreplace()などのメソッドは新しい文字列を返します。f文字列を使うと変数を文字列の中に埋め込め、数値も自然に表示できます。{pi:.2f} のように書式を指定すると、小数点以下の桁数を揃えて表示できます。 文字列は学習の初期から実務まで頻繁に使うため、検索のfind、分割のsplit、結合のjoinなども早めに触れておくと便利です。元の文字列は変わらないので、加工した結果は必ず別の変数に受け取る必要があります。",
  "code": "s = \"Python\"\nprint(s[0])\nprint(s[1:4])\nprint(len(s))\nprint(s.upper())\nname = \"花子\"\nprint(f\"こんにちは、{name}さん\")",
  "expected": "P\nyth\n6\nPYTHON\nこんにちは、花子さん",
  "pitfalls": "インデックスは0から始まります。範囲外を指定するとIndexErrorになるため、len()で長さを確認しましょう。",
  "terms": [
   "string",
   "immutable"
  ],
  "refs": [
   "len",
   "print"
  ]
 },
 {
  "id": "lists",
  "title": "リスト",
  "level": "入門",
  "category": "データ型",
  "goal": "リストの作成、要素の追加・変更、代表的なメソッドの使い方を理解する",
  "body": "リストは複数の値を順番に保持するミュータブルなデータ型で、角括弧で作ります。要素は型が混在してもよく、インデックスで取り出したり書き換えたりできます。append()で末尾に追加し、remove()やpop()で取り除けます。in演算子で要素が含まれるか確認でき、len()で要素数が分かります。リストは順序を保つため、成績や買い物リストのように並びに意味があるデータに適しています。代入では参照が共有される点も重要です。 リストはfor文との相性が良く、要素を順に処理する基本形になります。並べ替えのsortは元のリスト自体を変更し、sortedは新しいリストを返すという違いも押さえておきましょう。用途に応じて使い分けることが重要です。",
  "code": "fruits = [\"りんご\", \"みかん\"]\nfruits.append(\"ぶどう\")\nfruits[0] = \"もも\"\nprint(fruits)\nprint(len(fruits))\nprint(\"みかん\" in fruits)",
  "expected": "['もも', 'みかん', 'ぶどう']\n3\nTrue",
  "pitfalls": "リストを別の変数に代入してもコピーにはならず、同じリストを参照します。独立したコピーが欲しい場合はcopy()を使いましょう（ただし浅いコピーなので、入れ子のリストまで複製するには copy.deepcopy() が必要です）。",
  "terms": [
   "list",
   "mutable"
  ],
  "refs": [
   "list",
   "len",
   "print"
  ]
 },
 {
  "id": "dict-set",
  "title": "辞書と集合",
  "level": "入門",
  "category": "データ型",
  "goal": "辞書のキーと値の対応、集合の重複排除と集合演算を理解する",
  "body": "辞書はキーと値のペアを保持し、波括弧の中に キー: 値 の形で書きます。キーで値を素早く取り出せ、存在しないキーを直接参照するとKeyErrorになります。安全に取り出すならget()を使います。集合は重複を持たない要素の集まりで、set()や波括弧で作ります。重複の除去や、&による共通要素、|による和集合などの集合演算が得意です。辞書も集合も順序より対応関係や重複の有無を扱うための型です。 辞書のキーにはハッシュ可能な値（数値・文字列・タプルなど、主にイミュータブルな値）しか使えず、リストはキーにできません。集合は要素の存在確認が高速で、重複を取り除きたい場面や、共通要素を探す場面で力を発揮します。どちらもデータの性質に合わせて選ぶことが大切です。名前と値の対応を表す場面で特に有効です。",
  "code": "scores = {\"国語\": 80, \"数学\": 90}\nprint(scores[\"数学\"])\nprint(scores.get(\"英語\", 0))\na = {1, 2, 3}\nb = {2, 3, 4}\nprint(sorted(a & b))\nprint(len({1, 1, 2}))",
  "expected": "90\n0\n[2, 3]\n2",
  "pitfalls": "辞書で存在しないキーを [] で参照するとKeyErrorになります。不確かな場合はget()で既定値を指定しましょう。",
  "terms": [
   "dict",
   "set"
  ],
  "refs": [
   "dict",
   "set",
   "sorted",
   "len",
   "print"
  ]
 },
 {
  "id": "conditionals",
  "title": "条件分岐",
  "level": "入門",
  "category": "制御構文",
  "goal": "if・elif・elseで条件に応じて処理を分ける書き方を理解する",
  "body": "条件分岐はif文で書きます。ifの後ろに条件を書き、行末にコロンを付け、処理をインデントで揃えます。条件がFalseのときの別処理はelse、複数の条件を順に試す場合はelifを使います。条件は上から順に評価され、最初にTrueになったブロックだけが実行されます。そのため条件の順序が結果を左右します。比較演算子やand、orを組み合わせると範囲判定なども表現できます。インデントの深さがブロックの範囲を決める点がPythonの大きな特徴です。 条件式はTrueかFalseに評価される式であれば何でも使えます。数値の0や空文字列はFalseとして扱われるため、その性質を利用した簡潔な判定も可能です。ただし読み手に伝わる書き方を選ぶことが重要です。",
  "code": "score = 75\nif score >= 90:\n    grade = \"A\"\nelif score >= 70:\n    grade = \"B\"\nelse:\n    grade = \"C\"\nprint(grade)",
  "expected": "B",
  "pitfalls": "行末のコロンの付け忘れやインデントのずれはSyntaxErrorやIndentationErrorの代表例です。",
  "terms": [
   "type"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "loops",
  "title": "繰り返し",
  "level": "入門",
  "category": "制御構文",
  "goal": "for文とwhile文、range、breakとcontinueの使い分けを理解する",
  "body": "繰り返しには、要素を順に取り出すfor文と、条件がTrueの間続けるwhile文があります。回数が決まっている処理にはrange()とfor文の組み合わせが適し、range(3)は0、1、2を生成します。ループを途中で抜けるのがbreak、今回の処理だけを飛ばして次へ進むのがcontinueです。while文では条件がいつかFalseになるよう変数を更新しないと無限ループになります。リストなどの要素を直接取り出す書き方がPythonらしく、読みやすくなります。 要素とインデックスを同時に使いたい場合はenumerate()（enumerate(items, start=1) のように start を指定すると番号を1から始められます）、複数のリストを並行に扱う場合はzip()が便利です。繰り返しの形を道具として覚えておくと、処理を短く正確に書ける場面が大きく広がります。",
  "code": "total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)\nvals = []\nfor n in [1, 2, 3, 4]:\n    if n == 3:\n        continue\n    vals.append(str(n))\nprint(\" \".join(vals))",
  "expected": "10\n1 2 4",
  "pitfalls": "while文でカウンタの更新を忘れると無限ループになります。終了条件を先に確認してから書きましょう。",
  "terms": [
   "iterator"
  ],
  "refs": [
   "range",
   "print"
  ]
 },
 {
  "id": "functions",
  "title": "関数",
  "level": "入門",
  "category": "関数",
  "goal": "defによる関数の定義、引数と戻り値の仕組みを理解する",
  "body": "関数は処理に名前を付けて再利用できるようにしたもので、defで定義します。括弧の中に引数を書き、呼び出し時に渡された値を使って処理を行い、returnで結果を返します。returnがない関数はNoneを返します。同じ処理を何度も書く代わりに関数にまとめると、修正が一箇所で済み、読みやすくなります。引数にはデフォルト値を設定でき、省略時の値を用意できます。関数の先頭に書くdocstringで役割を説明する習慣も大切です。 関数は小さく分けるとテストしやすくなります。1つの関数は1つの役割に絞り、名前から処理が推測できるようにしましょう。戻り値を変数に受けて再利用する流れが、関数を組み合わせる基本になります。",
  "code": "def add(a, b=10):\n    return a + b\n\nprint(add(5, 3))\nprint(add(5))\nprint(add(1, 2) * 2)",
  "expected": "8\n15\n6",
  "pitfalls": "returnとprintは別物です。printは表示するだけであり、結果を次の計算に使うにはreturnで値を返す必要があります。",
  "terms": [
   "function",
   "argument",
   "return-value"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "import-module",
  "title": "importとモジュール",
  "level": "入門",
  "category": "モジュール",
  "goal": "import文でモジュールを読み込み、その機能を利用する方法を理解する",
  "body": "モジュールはPythonのコードをまとめたファイルで、importするとその中の関数や定数を使えるようになります。標準ライブラリにはmathやrandomなど便利なモジュールが用意されています。import mathと書けばmath.sqrt()のようにモジュール名を付けて呼び出します。from math import sqrtと書けば名前だけで呼べますが、由来が分かりにくくなる場合があります。自分で作った.pyファイルもモジュールとして読み込め、処理を分割して管理できます。 標準ライブラリの公式ドキュメントには各モジュールの使い方と例が載っています。読み込んだ名前が衝突する場合は、importにasで別名を付ける方法もあります。まず公式の提供する機能を確認する習慣が大切です。",
  "code": "import math\nfrom math import pi\n\nprint(math.sqrt(16))\nprint(math.floor(3.7))\nprint(round(pi, 2))",
  "expected": "4.0\n3\n3.14",
  "pitfalls": "自分のファイルにmath.pyのような標準ライブラリと同じ名前を付けると、意図せずそちらが読み込まれて混乱します。",
  "terms": [
   "module"
  ],
  "refs": [
   "round",
   "print"
  ]
 },
 {
  "id": "tuple-slice",
  "title": "タプルとスライス",
  "level": "基礎",
  "category": "データ型",
  "goal": "タプルの不変性と、スライスによる部分取得やステップ指定を理解する",
  "body": "タプルはカンマで区切って作る順序付きのデータで（通常は丸括弧で囲みます）、リストと似ていますが作成後に要素を変更できないイミュータブルな型です。座標や設定値など、変わらないはずのデータに適しています。要素が1つだけのタプルは末尾にカンマが必要です。スライスは [開始:終了:ステップ] の形で部分を取り出す仕組みで、終了位置は含まれません。負のインデックスやステップ-1を使うと末尾から取り出したり逆順にしたりできます。スライスは文字列やリストにも共通して使えます。 タプルは複数の戻り値を返す関数の受け皿としてもよく使われ、a, b = pair のように要素を分けて代入できます。スライスは元の並びを変更せず、リストでは新しいリストを返します。代入の左側に * を付けると（first, *rest = [1, 2, 3]）、残りの要素をリストにまとめて受け取れます。",
  "code": "point = (3, 4)\nprint(point[0])\nnums = [0, 1, 2, 3, 4, 5]\nprint(nums[1:4])\nprint(nums[::2])\nprint(nums[::-1])",
  "expected": "3\n[1, 2, 3]\n[0, 2, 4]\n[5, 4, 3, 2, 1, 0]",
  "pitfalls": "スライスの終了位置は範囲に含まれません。[1:4]はインデックス1から3までです。また要素1つのタプルにはカンマが必要です。",
  "terms": [
   "tuple",
   "immutable"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "comprehensions",
  "title": "内包表記",
  "level": "基礎",
  "category": "制御構文",
  "goal": "リスト内包表記で、変換や抽出を簡潔に書く方法を理解する",
  "body": "内包表記は、既存のイテラブルから新しいリストや辞書、集合を簡潔に作る記法です。基本形は [式 for 変数 in イテラブル] で、末尾にifを付けると条件を満たす要素だけを選べます。複数行のfor文とappendを1行で表せるため読みやすく、Pythonらしい書き方として広く使われます。ただし入れ子を深くしたり複雑な処理を詰め込んだりすると逆に読みにくくなります。単純な変換と抽出に絞って使うのが目安です。辞書内包表記ではキーと値の両方を指定します。 内包表記は集合やジェネレータにも応用でき、括弧の種類で得られる型が変わります。処理の中に副作用を持たせず、値を集める目的に絞ると意図が明確になり、通常のfor文への書き換えも容易になります。",
  "code": "nums = [1, 2, 3, 4, 5]\nsquares = [n * n for n in nums]\nevens = [n for n in nums if n % 2 == 0]\nprint(squares)\nprint(evens)\nprint({n: n * 10 for n in nums[:2]})",
  "expected": "[1, 4, 9, 16, 25]\n[2, 4]\n{1: 10, 2: 20}",
  "pitfalls": "複雑な処理まで内包表記に詰め込むと読みにくくなります。二重ループや長い条件は通常のfor文に分けましょう。",
  "terms": [
   "list",
   "iterator"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "exceptions",
  "title": "例外処理",
  "level": "基礎",
  "category": "例外",
  "goal": "try・except・else・finallyでエラーを安全に扱う方法を理解する",
  "body": "実行中に起きるエラーは例外として発生し、そのままではプログラムが停止します。tryブロックに通常の処理を書き、exceptで例外の種類ごとに受け止めると、異常時でも適切に対処できます。例外が発生しなかったときに実行するelse、成否にかかわらず必ず実行するfinallyも用意されています。exceptを広く書きすぎると本当のバグまで隠してしまうため、ValueErrorなど具体的な例外を指定するのが基本です。raiseで意図的に例外を発生させることもできます。 例外には発生箇所と原因を示すトレースバックが付きます。下から上に読むと、どの呼び出しで何が起きたか追えます。回復できない例外は無理に捕捉せず、呼び出し元へ伝える判断も必要です。",
  "code": "def parse(text):\n    try:\n        return int(text)\n    except ValueError:\n        return None\n\nprint(parse(\"42\"))\nprint(parse(\"abc\"))\ntry:\n    print(10 / 0)\nexcept ZeroDivisionError as e:\n    print(type(e).__name__)",
  "expected": "42\nNone\nZeroDivisionError",
  "pitfalls": "except: とだけ書いて全例外を握りつぶすと、想定外のバグに気付けなくなります。種類を指定して捕捉しましょう。",
  "terms": [
   "exception"
  ],
  "refs": [
   "int",
   "print",
   "type"
  ]
 },
 {
  "id": "file-io",
  "title": "ファイル操作",
  "level": "基礎",
  "category": "ファイル",
  "goal": "with文を使ったテキストファイルの読み書きの基本を理解する",
  "body": "ファイルを扱う基本はopen()です。第1引数にパス、第2引数にモードを指定します。読み取りは r（省略時）、書き込みは w、追記は a です。with文で開くと、ブロックを抜けたとき（例外が起きた場合も）自動で閉じられるため、閉じ忘れを防げます。全体を読むにはread()、1行ずつ処理するにはファイルオブジェクトをfor文で回します。文字コードは環境差の原因になりやすいので、encoding=\"utf-8\"を明示するのが安全です（Python 3.14 以前では、省略時の文字コードが環境依存で、Windowsなどで UTF-8 以外になることがあります。3.15 から既定が UTF-8 になりますが、どの版でも明示しておけば確実です）。 このアプリでは、ファイルはブラウザ内の仮想ファイルシステムに書き込まれます（端末の実際のフォルダには保存されません）。Studioで実行したプログラムが作ったファイルはファイル一覧に反映され、ダウンロードできます。書き込んだ後に読み直して確かめると、保存漏れにも気付けます。",
  "code": "with open(\"memo.txt\", \"w\", encoding=\"utf-8\") as f:\n    f.write(\"1行目\\n\")\n    f.write(\"2行目\\n\")\n\nwith open(\"memo.txt\", encoding=\"utf-8\") as f:\n    lines = f.read().splitlines()\nprint(len(lines))\nprint(lines[0])\n\nwith open(\"memo.txt\", \"a\", encoding=\"utf-8\") as f:\n    f.write(\"3行目\\n\")\n\nwith open(\"memo.txt\", encoding=\"utf-8\") as f:\n    for line in f:\n        print(line.rstrip(\"\\n\"))",
  "expected": "2\n1行目\n1行目\n2行目\n3行目",
  "pitfalls": "モード w で開くと既存の内容は上書きされて消えます。追記したい場合は a を使うことと、encodingの明示が大切です。",
  "terms": [
   "context-manager"
  ],
  "refs": [
   "open",
   "with",
   "print",
   "len"
  ]
 },
 {
  "id": "args-scope",
  "title": "引数とスコープ",
  "level": "中級",
  "category": "関数",
  "goal": "位置引数・キーワード引数・可変長引数と、ローカル変数の有効範囲を理解する",
  "body": "関数の引数には、順番で渡す位置引数、名前で指定するキーワード引数があります。*argsは余った位置引数をタプルに、**kwargsはキーワード引数を辞書にまとめます。これにより柔軟な関数が作れますが、使いすぎると呼び出し方が分かりにくくなります。スコープは変数が有効な範囲で、関数の中で代入した変数は原則ローカルとなり、外側の同名変数とは別物です。関数外の変数は読み取りはできますが、書き換えには注意が必要です。 引数のデフォルト値にリストなどのミュータブルな値を使うと、呼び出し間で共有されて思わぬ変更が残ります。既定値にはNoneを使い、関数内で作り直す書き方が安全な定石として知られています。 呼び出し側の読みやすさにも直結します。",
  "code": "def total(*args, start=0):\n    return start + sum(args)\n\nprint(total(1, 2, 3))\nprint(total(10, 20, start=5))\nx = 100\ndef show():\n    x = 1\n    return x\nprint(show())\nprint(x)",
  "expected": "6\n35\n1\n100",
  "pitfalls": "関数内で外側の変数を読み込むだけなら問題ありませんが、代入するとローカル変数とみなされ、代入前の参照でUnboundLocalErrorになります。",
  "terms": [
   "scope",
   "argument",
   "function"
  ],
  "refs": [
   "sum",
   "print"
  ]
 },
 {
  "id": "class-inheritance",
  "title": "クラスと継承",
  "level": "中級",
  "category": "オブジェクト指向",
  "goal": "classによる定義、__init__とself、継承とメソッドの上書きを理解する",
  "body": "クラスはデータと振る舞いをまとめた設計図で、classキーワードで定義します。生成時に呼ばれる__init__で属性を初期化し、各メソッドの第1引数selfはインスタンス自身を指します。クラスから作った実体がインスタンスです。継承を使うと既存のクラスを基に新しいクラスを作り、共通部分を引き継ぎながらメソッドを上書きできます。これによりコードの重複を減らせます。属性へのアクセスやメソッド呼び出しはドット記法で行います。 クラスは現実の概念をそのまま写す必要はなく、プログラムの中で必要なデータと操作だけを切り取って表現します。継承を深くしすぎると理解が難しくなるため、組み合わせで表せないかも検討しましょう。",
  "code": "class Animal:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        return \"...\"\n\nclass Dog(Animal):\n    def speak(self):\n        return \"ワン\"\n\ndog = Dog(\"ポチ\")\nprint(dog.name)\nprint(dog.speak())",
  "expected": "ポチ\nワン",
  "pitfalls": "メソッド定義でselfを書き忘れると、呼び出し時に引数の数が合わずTypeErrorになります。",
  "terms": [
   "class",
   "inheritance",
   "object",
   "instance"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "iterator-generator",
  "title": "イテレータとジェネレータ",
  "level": "中級",
  "category": "オブジェクト指向",
  "goal": "イテラブルの考え方と、yieldによるジェネレータの遅延評価を理解する",
  "body": "イテラブルはfor文で要素を順に取り出せるオブジェクトで、リストや文字列、rangeなどが該当します。その反復を実際に進めるのがイテレータで、next()で次の要素を返し、終わるとStopIterationが発生します。ジェネレータはyieldを含む関数で、呼び出すとジェネレータオブジェクトを返し、値を1つ返すたびに処理を一時停止します。全要素をメモリに持たずに済むため、大きなデータや無限に続く列の処理に適しています。必要なときに必要な分だけ計算する遅延評価が特徴です。 range自体も必要な値を順に生み出す仕組みであり、全ての数列を先に作っているわけではありません。大きなファイルを1行ずつ読む処理も同じ考え方で、メモリ使用量を抑えた設計につながります。",
  "code": "def countdown(n):\n    while n > 0:\n        yield n\n        n -= 1\n\nprint(list(countdown(3)))\ngen = (x * x for x in range(4))\nprint(next(gen))\nprint(next(gen))",
  "expected": "[3, 2, 1]\n0\n1",
  "pitfalls": "ジェネレータは一度消費すると元に戻れません。再度使いたい場合はもう一度生成し直す必要があります。",
  "terms": [
   "iterator",
   "generator"
  ],
  "refs": [
   "list",
   "range",
   "print"
  ]
 },
 {
  "id": "decorator",
  "title": "デコレータ",
  "level": "中級",
  "category": "関数",
  "goal": "関数を受け取って新しい関数を返すデコレータの仕組みと@記法を理解する",
  "body": "デコレータは関数を受け取り、処理を追加した新しい関数を返す仕組みです。関数定義の上に@名前と書くことで適用できます。元の関数のコードを変更せずに、ログ出力や計測、権限チェックなどの共通処理を差し込めるのが利点です。内部では、受け取った関数を包むラッパー関数を定義して返す形が基本です。ラッパー側で *args と **kwargs を受けると、どんな引数の関数にも対応できます。標準ライブラリにも functools.lru_cache など実用的なデコレータがあります。 デコレータを自作するときは、ラッパー関数に @functools.wraps(func) を付けて、元の関数の名前（__name__）やdocstringを引き継ぐのが定石です。付けないと、デバッグ時やドキュメント表示で wrapper という名前に置き換わって混乱します。",
  "code": "def shout(func):\n    def wrapper(name):\n        return func(name).upper() + \"!\"\n    return wrapper\n\n@shout\ndef greet(name):\n    return f\"hello {name}\"\n\nprint(greet(\"taro\"))",
  "expected": "HELLO TARO!",
  "pitfalls": "デコレータを重ねると適用順序で結果が変わります。下に書いたものから先に適用される点に注意しましょう。",
  "terms": [
   "decorator",
   "function"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "stdlib",
  "title": "標準ライブラリ",
  "level": "中級",
  "category": "モジュール",
  "goal": "collectionsやitertools、datetimeなど代表的な標準ライブラリの役割を知る",
  "body": "標準ライブラリはPythonに最初から付属するモジュール群で、追加インストールなしに使えます。collectionsのCounterは要素の出現回数を数え、defaultdictは既定値付き辞書を提供します。itertoolsは反復処理の道具、datetimeは日時の計算、jsonはJSON形式との変換、pathlibはパスの操作を扱います。すべてを覚える必要はなく、困った場面で該当するモジュールがあるか調べる姿勢が大切です。自前で複雑な処理を書く前に、標準ライブラリで済まないか確認すると品質が上がります。 randomは抽選やサンプル生成、reは文字列のパターン検索、osやpathlibはファイル周りの処理に使われます。モジュールごとに公式ドキュメントの例が豊富なので、写して動かしながら覚えるのが近道です。",
  "code": "from collections import Counter\nimport json\n\nc = Counter(\"banana\")\nprint(c[\"a\"])\nprint(c.most_common(1))\ndata = json.loads('{\"x\": 10}')\nprint(data[\"x\"] + 5)",
  "expected": "3\n[('a', 3)]\n15",
  "pitfalls": "標準ライブラリと同じ名前のファイル（json.pyなど）を自作すると、importでそちらが優先されエラーになることがあります。",
  "terms": [
   "module",
   "library"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "type-hints",
  "title": "型ヒント",
  "level": "中級",
  "category": "型",
  "goal": "型ヒントの書き方と、実行時には強制されないという性質を理解する",
  "body": "型ヒントは変数や関数の引数、戻り値に期待する型を注釈として書く仕組みで、def f(x: int) -> int: のように記述します。リストや辞書は list[int]、dict[str, int] のように要素の型まで書けます。重要なのは、型ヒントはあくまで注釈であり、実行時にPython自身が強制的にチェックするわけではない点です。型と異なる値を渡しても即エラーにはならない場合があります。その代わり、エディタの補完や静的解析ツールが誤りを早期に発見する助けになります。 OptionalやUnionを使うと、値が無い場合や複数の型を許す場合も表現できます。型ヒントが充実すると、関数を読むだけで入出力の想定が分かり、チーム開発や保守の負担が大きく下がります。",
  "code": "def double(x: int) -> int:\n    return x * 2\n\ndef first(names: list[str]) -> str:\n    return names[0]\n\nprint(double(21))\nprint(first([\"a\", \"b\"]))\nprint(double.__annotations__)",
  "expected": "42\na\n{'x': <class 'int'>, 'return': <class 'int'>}",
  "pitfalls": "型ヒントを書いたからといって実行時に型検査されるわけではありません。境界では必要に応じて自分で検証しましょう。",
  "terms": [
   "type-hint"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "context-manager",
  "title": "コンテキストマネージャ",
  "level": "上級",
  "category": "制御構文",
  "goal": "with文の仕組みと、__enter__・__exit__による後片付けの自動化を理解する",
  "body": "コンテキストマネージャはwith文で使う仕組みで、処理の開始と終了に必ず行いたい前処理と後片付けを自動化します。代表例がファイルで、withを抜けると例外が起きても確実に閉じられます。自分で作る場合は__enter__と__exit__を実装したクラスを用意するか、contextlibの@contextmanagerでジェネレータ関数から作れます。__exit__は例外の情報を引数で受け取り、通常は伝播を止めません。リソースの確保と解放を対にする場面全般で役立ちます。 データベース接続やロックの取得と解放など、ファイル以外でも対になる操作はwithで管理する設計が一般的です。終了処理が保証されることで、例外時の資源の残留を防ぎやすくなります。",
  "code": "from contextlib import contextmanager\n\n@contextmanager\ndef tag(name):\n    print(f\"<{name}>\")\n    try:\n        yield\n    finally:\n        print(f\"</{name}>\")\n\nwith tag(\"p\"):\n    print(\"中身\")",
  "expected": "<p>\n中身\n</p>",
  "pitfalls": "@contextmanager で作るときは yield を try/finally で囲まないと、with の中で例外が起きた場合に後片付け（yield の後）が実行されません。また、withを使わず手動でclose()すると、途中で例外が起きたときに閉じ忘れる恐れがあります。後片付けはwithに任せましょう。",
  "terms": [
   "context-manager"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "async-intro",
  "title": "非同期処理入門",
  "level": "上級",
  "category": "並行処理",
  "goal": "async defとawait、asyncio.runの基本的な流れを理解する",
  "body": "非同期処理は、待ち時間の長い処理の完了を待つ間に別の処理を進める仕組みです。async defで定義した関数はコルーチンとなり、呼び出すだけでは実行されず、awaitで待つかタスクとして登録したときに進みます。入口ではasyncio.run()でイベントループを起動します。ネットワークやファイル入出力のような待ちが多い処理で効果があり、計算自体が重い処理を速くするものではありません。通常の関数呼び出しとの違いを意識し、awaitの付け忘れに注意が必要です。 asyncio.gatherでは複数のコルーチンを並行に待てます（結果は完了順ではなく渡した順に並びます）。なお、ブラウザ版Python（Pyodide）ではページ側のイベントループが既に動いているため、このアプリは先頭レベルの asyncio.run(…) を await として実行します。通常のPythonではasyncio.runがそのまま使われます。ただし共有データへの同時書き込みには注意が必要で、処理の順序が通常のコードとは異なる点を、実際に時間を計りながら確かめると理解が深まります。",
  "code": "import asyncio\n\nasync def greet(name, delay):\n    await asyncio.sleep(delay)\n    return f\"hello {name}\"\n\nasync def main():\n    results = await asyncio.gather(greet(\"a\", 0), greet(\"b\", 0))\n    print(results)\n\nasyncio.run(main())",
  "expected": "['hello a', 'hello b']",
  "pitfalls": "コルーチンをawaitせずに呼び出すだけでは中身は実行されず、警告が出ます。結果が必要な場所では必ずawaitしましょう。",
  "terms": [
   "async"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "numpy-pandas",
  "title": "NumPyとpandas入門",
  "level": "応用",
  "category": "データ分析",
  "goal": "NumPy配列の要素ごとの計算と、pandasのDataFrameによる表データ操作の入口を理解する",
  "body": "NumPyは数値計算用ライブラリで、ndarrayという配列に対する要素ごとの高速な演算を提供します。通常のリストと違い、配列に数値を足すと全要素に適用されます。pandasは表形式データを扱うライブラリで、DataFrameが中心です。列の選択、条件による行の抽出、mean()などの集計が簡潔に書けます。CSVなどの外部データを読み込んで加工する実務で広く使われます。なお、これらは外部ライブラリであり、ブラウザ環境では対応状況が通常のPython環境と異なる場合があります。 pandasでは列同士の演算やgroupbyによる集計も可能で、Excel作業の自動化にもつながります。まずは小さなデータで列選択と集計を試し、結果を目で確認しながら少しずつ操作を増やしていくのが確実です。",
  "code": "import numpy as np\nimport pandas as pd\n\narr = np.array([1, 2, 3])\nprint((arr * 10).tolist())\ndf = pd.DataFrame({\"name\": [\"a\", \"b\"], \"score\": [80, 90]})\nprint(df[\"score\"].mean())\nprint(list(df[\"name\"]))",
  "expected": "[10, 20, 30]\n85.0\n['a', 'b']",
  "pitfalls": "リストに数値を直接足すことはできませんが（TypeError）、ndarrayでは要素ごとの計算になります。型の違いによる演算の差に注意しましょう。",
  "terms": [],
  "refs": [
   "list",
   "print"
  ]
 },
 {
  "id": "string-methods",
  "title": "文字列メソッド詳解",
  "level": "基礎",
  "category": "文字列",
  "goal": "split/join/replace/stripなど日常的に使う文字列メソッドを使い分けられる",
  "body": "文字列は不変（イミュータブル）で、メソッドは元の文字列を変更せず新しい文字列を返します。stripは前後の空白を取り除き、splitは区切り文字で分割してリストを返し、joinはその逆でリストを1つの文字列に連結します。replaceは部分文字列を置換します。入力データの整形では「stripしてからsplitする」のが定番の流れです。メソッドチェーンでつなげて書けるのも特徴で、読みやすさのために適度に分割することも大切です。",
  "code": "text = \"  apple,banana,orange  \"\nparts = text.strip().split(\",\")\nprint(parts)\nprint(\"-\".join(parts))\nprint(\"banana\".replace(\"a\", \"o\"))",
  "expected": "['apple', 'banana', 'orange']\napple-banana-orange\nbonono",
  "pitfalls": "メソッドの結果を受け取らず、元の文字列が変わったと思い込むミスが多いです。必ず代入するか、その場で使ってください。",
  "terms": [
   "string",
   "immutable"
  ],
  "refs": [
   "str.split",
   "str.join"
  ]
 },
 {
  "id": "list-operations",
  "title": "リスト操作詳解",
  "level": "基礎",
  "category": "リスト",
  "goal": "append/extend/sort/sorted/copyの違いを正確に使い分けられる",
  "body": "appendは要素を1つ追加し、extendは別のリストの要素をまとめて追加します。sortは元のリスト自体を並べ替えてNoneを返し、sortedは新しいリストを返して元を変えません。この違いは実務で頻出のバグの元です。copyは浅いコピーを作り、単純な代入では同じリストを指すだけ（エイリアス）になる点も重要です。安全に扱うなら、元のデータを壊したくない場面ではsortedとcopyを使うのが基本です。",
  "code": "nums = [3, 1, 2]\nnums.append(4)\nnums.extend([5, 6])\nprint(nums)\nprint(sorted(nums, reverse=True))\ncopied = nums.copy()\ncopied.append(99)\nprint(len(nums), len(copied))",
  "expected": "[3, 1, 2, 4, 5, 6]\n[6, 5, 4, 3, 2, 1]\n6 7",
  "pitfalls": "sort()の戻り値を代入してリストをNoneにしてしまうミスが代表的です。並べ替えた結果が欲しいならsortedを使ってください。",
  "terms": [
   "list",
   "mutable"
  ],
  "refs": [
   "list.append",
   "list.sort",
   "sorted"
  ]
 },
 {
  "id": "dict-operations",
  "title": "辞書操作詳解",
  "level": "基礎",
  "category": "辞書",
  "goal": "get/setdefault/itemsで安全に辞書を読み書きできる",
  "body": "辞書はキーで値を引く構造で、存在しないキーを直接参照するとKeyErrorになります。getはキーが無いときに既定値を返して安全に読め、setdefaultは無ければ追加してから値を返します。items()でキーと値を同時に回すのが基本形です。辞書は挿入順を保つため、ループ出力の順序も予測できます。設定値や集計結果の保持など、実務で最も使うデータ構造の1つです。",
  "code": "user = {\"name\": \"Taro\", \"age\": 20}\nuser[\"age\"] = 21\nuser.setdefault(\"city\", \"Tokyo\")\nprint(user.get(\"email\", \"未登録\"))\nfor k, v in user.items():\n    print(k, v)",
  "expected": "未登録\nname Taro\nage 21\ncity Tokyo",
  "pitfalls": "キーの存在を確認せずに d[key] と書いてKeyErrorになるケースが多発します。無い可能性があるキーはgetで読んでください。",
  "terms": [
   "dict"
  ],
  "refs": [
   "dict.get",
   "dict.items"
  ]
 },
 {
  "id": "function-arguments",
  "title": "関数の引数詳解",
  "level": "中級",
  "category": "関数",
  "goal": "デフォルト引数・キーワード引数・*args/**kwargsを使い分けられる",
  "body": "引数には位置で渡す方法と、名前を指定するキーワード引数があります。デフォルト値を用意すると呼び出し側は省略でき、APIが使いやすくなります。*argsは任意個数の位置引数をタプルとして受け取り、**kwargsはキーワード引数を辞書として受け取ります。柔軟な反面、受け取る側の仕様が見えにくくなるため、乱用せず本当に可変な場合だけ使うのが実務の作法です。",
  "code": "def greet(name, msg=\"こんにちは\"):\n    return f\"{msg}、{name}さん\"\nprint(greet(\"花子\"))\nprint(greet(\"花子\", msg=\"やあ\"))\ndef total(*args, **kwargs):\n    return sum(args) + sum(kwargs.values())\nprint(total(1, 2, bonus=10))",
  "expected": "こんにちは、花子さん\nやあ、花子さん\n13",
  "pitfalls": "デフォルト引数にリストや辞書を使うと呼び出し間で共有されてしまいます。Noneを既定にして関数内で作るのが定石です。",
  "terms": [
   "function",
   "argument"
  ],
  "refs": [
   "print"
  ]
 },
 {
  "id": "exceptions-advanced",
  "title": "例外処理の作法",
  "level": "中級",
  "category": "例外処理",
  "goal": "try/except/else/finallyの役割とraiseの考え方を理解する",
  "body": "tryブロックで例外が起きなければelseが実行され、例外の有無にかかわらずfinallyは必ず実行されます。この分担で「成功時の処理」と「後片付け」を分けて書けます。例外を握りつぶして無言で続行するのは最悪の作法で、原因不明の不具合を生みます。自分で例外を起こすraiseは、呼び出し側に異常を知らせる正式な手段です。ライブラリでは例外で知らせ、アプリケーションの入口で捕まえるのが基本設計です。",
  "code": "def divide(a, b):\n    try:\n        result = a / b\n    except ZeroDivisionError:\n        print(\"0では割れません\")\n        return None\n    else:\n        print(\"計算成功\")\n        return result\n    finally:\n        print(\"処理終了\")\nprint(divide(10, 2))",
  "expected": "計算成功\n処理終了\n5.0",
  "pitfalls": "except: と素で書いて全ての例外を握りつぶすと、タイプミスなどの本当のバグまで隠れてしまいます。捕まえる例外は具体的に書きましょう。",
  "terms": [
   "exception"
  ],
  "refs": [
   "try"
  ]
 },
 {
  "id": "csv-files",
  "title": "CSVファイルの読み書き",
  "level": "応用",
  "category": "ファイル",
  "goal": "csvモジュールで表データを辞書として読み、集計できる",
  "body": "CSVはカンマ区切りの表データ形式で、業務データの受け渡しに広く使われます。csvモジュールのDictReaderは1行目をヘッダとして、各行を辞書で返してくれるため、列名で安全にアクセスできます。読み取った値は全て文字列なので、数値として使うにはintやfloatへの変換が必要です。ファイルから読むときは with open(\"data.csv\", newline=\"\", encoding=\"utf-8\") as f: のように開き、newline=\"\" を指定するのが csv モジュールの公式な作法です（改行の誤変換を防ぎます）。Excelで保存したCSVは encoding=\"utf-8-sig\"（BOM付き）や cp932 のことがあります。",
  "code": "import csv, io\ndata = \"name,score\\nTaro,80\\nHana,95\\n\"\nrows = list(csv.DictReader(io.StringIO(data)))\nprint(rows[1][\"name\"], rows[1][\"score\"])\nprint(sum(int(r[\"score\"]) for r in rows))",
  "expected": "Hana 95\n175",
  "pitfalls": "CSVの値は文字列のままなので、そのまま計算するとTypeErrorになります。数値列は必ず変換してください。",
  "terms": [
   "module"
  ],
  "refs": [
   "open"
  ]
 },
 {
  "id": "sets-operations",
  "title": "集合演算",
  "level": "基礎",
  "category": "辞書と集合",
  "goal": "集合の積・和・差と、重複除去への応用を使える",
  "body": "集合（set）は重複を持たない集まりで、積集合（&）・和集合（|）・差集合（-）の演算が直接書けます。「両方に含まれるもの」「片方だけにあるもの」といった抽出が、ループを書かずに表現できるのが強みです。また、リストをsetに変換すると重複が除去できるため、重複除去の定番手段でもあります。ただし集合は順序を保たないため、順序が要る場合はsortedと組み合わせます。",
  "code": "a = {1, 2, 3, 4}\nb = {3, 4, 5}\nprint(sorted(a & b))\nprint(sorted(a | b))\nprint(sorted(a - b))\nprint(len(set([1, 1, 2, 3, 3])))",
  "expected": "[3, 4]\n[1, 2, 3, 4, 5]\n[1, 2]\n3",
  "pitfalls": "集合は順序を持たないため、そのまま表示したときの並びは保証されません（実行環境や要素によって変わり得ます）。表示や比較ではsortedでリスト化してください。",
  "terms": [
   "set"
  ],
  "refs": [
   "set"
  ]
 },
 {
  "id": "sorting-key",
  "title": "並べ替えのkey",
  "level": "中級",
  "category": "リスト",
  "goal": "sortedのkeyで「何を基準に並べるか」を指定できる",
  "body": "sortedやsortのkey引数に「各要素から比較用の値を取り出す関数」を渡すと、その値で並べ替えられます。文字列の長さ順、タプルの2番目の要素順、辞書の特定キー順など、実務の並べ替えのほとんどはkeyで表現できます。lambdaはその場だけ使う小さな関数を作る記法で、keyとの組み合わせが定番です。複数条件で並べたい場合は、keyにタプルを返させると優先順に効きます。",
  "code": "words = [\"banana\", \"kiwi\", \"apple\", \"fig\"]\nprint(sorted(words, key=len))\npeople = [(\"Taro\", 30), (\"Hana\", 25)]\nprint(sorted(people, key=lambda p: p[1]))",
  "expected": "['fig', 'kiwi', 'apple', 'banana']\n[('Hana', 25), ('Taro', 30)]",
  "pitfalls": "keyは「比較そのもの」ではなく「値を取り出す関数」を渡す場所です。2引数を取る比較関数を渡すとエラーになります。",
  "terms": [
   "function"
  ],
  "refs": [
   "sorted",
   "list.sort"
  ]
 }
];
